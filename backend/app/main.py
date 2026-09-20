import json
import os
import shutil
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.media import PUBLIC_UPLOAD_BASE_URL, is_placeholder_url, usable_media_url
from app.db import models
from app.db.database import Base, engine, get_db
from app.workflow.graph import app_workflow


UPLOAD_DIR = os.getenv("XIESHANG_UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "user_profiles" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("user_profiles")}
        statements = []
        if "nickname" not in existing:
            statements.append("ALTER TABLE user_profiles ADD COLUMN nickname VARCHAR")
        if "gender" not in existing:
            statements.append("ALTER TABLE user_profiles ADD COLUMN gender VARCHAR")
        if "avatar_url" not in existing:
            statements.append("ALTER TABLE user_profiles ADD COLUMN avatar_url VARCHAR")
        if "created_at" not in existing:
            statements.append("ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP DEFAULT NOW() NOT NULL")
        if "updated_at" not in existing:
            statements.append("ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL")

        if statements:
            with engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))


ensure_schema()

app = FastAPI(title="偕裳 MVP API", description="个性化虚拟试穿平台核心调度接口")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


class SessionPayload(BaseModel):
    user_id: Optional[str] = None
    nickname: str = "小鹿酱"
    gender: str = "female"
    avatar_url: Optional[str] = None


class WardrobeItemPayload(BaseModel):
    name: str
    category: str
    image_url: str
    color: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    source: str = "manual"


class WardrobeItemPatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[list[str]] = None
    source: Optional[str] = None


class OutfitPayload(BaseModel):
    name: str
    scene: Optional[str] = None
    cover_url: Optional[str] = None
    item_ids: list[int] = Field(default_factory=list)


class OutfitPatch(BaseModel):
    name: Optional[str] = None
    scene: Optional[str] = None
    cover_url: Optional[str] = None
    item_ids: Optional[list[int]] = None


class DiscoverActionPayload(BaseModel):
    user_id: str


def now() -> datetime:
    return datetime.utcnow()


def dt(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def file_url_for(path: str) -> str:
    return f"{PUBLIC_UPLOAD_BASE_URL}/{os.path.basename(path)}"


def save_upload(file: UploadFile, prefix: str) -> str:
    clean_name = os.path.basename(file.filename or "upload")
    file_id = str(uuid.uuid4())[:8]
    file_path = os.path.join(UPLOAD_DIR, f"{prefix}_{file_id}_{clean_name}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return file_url_for(file_path)


def clear_placeholder_profile_media(profile: models.UserProfile) -> bool:
    changed = False
    if is_placeholder_url(profile.base_avatar_url):
        profile.base_avatar_url = None
        changed = True
    if is_placeholder_url(profile.avatar_url):
        profile.avatar_url = "/mock/avatar.svg"
        changed = True
    return changed


def workflow_error(result: dict[str, Any], required_fields: tuple[str, ...] = ()) -> Optional[str]:
    if result.get("error_message"):
        return str(result["error_message"])
    missing = [field for field in required_fields if not usable_media_url(result.get(field))]
    if missing:
        return f"AI 处理未返回有效图片：{', '.join(missing)}"
    return None


def serialize_user(profile: models.UserProfile) -> dict[str, Any]:
    base_avatar_url = usable_media_url(profile.base_avatar_url)
    avatar_url = usable_media_url(profile.avatar_url) or base_avatar_url or "/mock/avatar.svg"
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "nickname": profile.nickname or "小鹿酱",
        "gender": profile.gender or "female",
        "avatar_url": avatar_url,
        "height": profile.height,
        "weight": profile.weight,
        "original_photo_url": profile.original_photo_url,
        "base_avatar_url": base_avatar_url,
        "user_profile_tags": profile.user_profile_tags or {},
        "created_at": dt(profile.created_at),
        "updated_at": dt(profile.updated_at),
    }


def serialize_wardrobe(item: models.WardrobeItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "name": item.name,
        "category": item.category,
        "image_url": item.image_url,
        "color": item.color,
        "tags": item.tags or [],
        "source": item.source,
        "created_at": dt(item.created_at),
        "updated_at": dt(item.updated_at),
    }


def serialize_outfit(outfit: models.Outfit) -> dict[str, Any]:
    return {
        "id": outfit.id,
        "user_id": outfit.user_id,
        "name": outfit.name,
        "scene": outfit.scene,
        "cover_url": outfit.cover_url,
        "items": [
            {
                "id": item.id,
                "wardrobe_item_id": item.wardrobe_item_id,
                "name": item.name,
                "category": item.category,
                "image_url": item.image_url,
            }
            for item in outfit.items
        ],
        "created_at": dt(outfit.created_at),
        "updated_at": dt(outfit.updated_at),
    }


def serialize_record(record: models.TryonRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "user_id": record.user_id,
        "type": record.type,
        "scene": record.scene,
        "input_photo_url": record.input_photo_url,
        "product_url": usable_media_url(record.product_url),
        "styling_suggestion": record.styling_suggestion,
        "generated_product_url": usable_media_url(record.generated_product_url),
        "final_tryon_url": usable_media_url(record.final_tryon_url),
        "created_at": dt(record.created_at),
    }


def get_or_create_user(db: Session, user_id: str, nickname: str = "小鹿酱") -> models.UserProfile:
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if profile:
        if clear_placeholder_profile_media(profile):
            profile.updated_at = now()
            db.commit()
            db.refresh(profile)
        seed_user_content(db, user_id)
        return profile

    profile = models.UserProfile(user_id=user_id, nickname=nickname, gender="female", avatar_url="/mock/avatar.svg")
    db.add(profile)
    db.commit()
    db.refresh(profile)
    seed_user_content(db, user_id)
    return profile


def seed_user_content(db: Session, user_id: str) -> None:
    if db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == user_id).first():
        return

    samples = [
        ("紫色针织衫", "上衣", "/mock/wardrobe-purple.svg", "薰衣草紫", ["温柔", "约会"]),
        ("白色衬衫", "上衣", "/mock/wardrobe-shirt.svg", "奶油白", ["通勤", "百搭"]),
        ("米色西装外套", "外套", "/mock/wardrobe-blazer.svg", "燕麦米", ["职场", "高级感"]),
        ("直筒牛仔裤", "下装", "/mock/wardrobe-jeans.svg", "浅牛仔蓝", ["休闲", "显瘦"]),
        ("法式连衣裙", "连衣裙", "/mock/wardrobe-dress.svg", "象牙白", ["约会", "优雅"]),
        ("小白鞋", "鞋子", "/mock/wardrobe-shoes.svg", "白色", ["舒适", "日常"]),
        ("米色单肩包", "包包", "/mock/wardrobe-bag.svg", "奶茶米", ["精致", "通勤"]),
        ("贝雷帽", "配饰", "/mock/wardrobe-hat.svg", "浅米色", ["法式", "氛围感"]),
    ]
    items = [
        models.WardrobeItem(
            user_id=user_id,
            name=name,
            category=category,
            image_url=image_url,
            color=color,
            tags=tags,
            source="seed",
        )
        for name, category, image_url, color, tags in samples
    ]
    db.add_all(items)
    db.commit()

    created_items = db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == user_id).all()
    by_name = {item.name: item for item in created_items}
    outfit_specs = [
        ("温柔约会穿搭", "约会", ["紫色针织衫", "直筒牛仔裤", "小白鞋", "米色单肩包"]),
        ("职场通勤穿搭", "职场", ["白色衬衫", "米色西装外套", "直筒牛仔裤"]),
        ("周末休闲穿搭", "日常休闲", ["法式连衣裙", "贝雷帽", "米色单肩包"]),
    ]
    for name, scene, names in outfit_specs:
        outfit = models.Outfit(user_id=user_id, name=name, scene=scene, cover_url="/mock/outfit-cover.svg")
        db.add(outfit)
        db.flush()
        for item_name in names:
            item = by_name.get(item_name)
            if item:
                db.add(
                    models.OutfitItem(
                        outfit_id=outfit.id,
                        wardrobe_item_id=item.id,
                        name=item.name,
                        category=item.category,
                        image_url=item.image_url,
                    )
                )
    db.commit()


def seed_discover_posts(db: Session) -> None:
    if db.query(models.DiscoverPost).first():
        return

    posts = [
        ("紫色开衫真的太温柔了！春天必备单品", "泡泡", "约会", "推荐", "/mock/discover-purple.svg", 632),
        ("职场通勤穿搭分享｜气质干练又不失温柔", "Olivia", "职场", "推荐", "/mock/discover-blue.svg", 521),
        ("海边度假穿搭，碎花裙太出片啦", "小夏天", "旅行", "潮流趋势", "/mock/discover-beach.svg", 804),
        ("通勤气质穿搭，简约高级感轻松 hold 住全场", "职场穿搭小助手", "职场", "搭配技巧", "/mock/discover-blazer.svg", 731),
        ("春季穿搭，简约休闲风舒服又好看", "穿搭研究所", "日常休闲", "推荐", "/mock/discover-casual.svg", 618),
        ("奶油色系穿搭分享，温柔又显气质", "小鹿酱", "约会", "品牌", "/mock/discover-cream.svg", 682),
        ("早春通勤穿搭，气质又减龄", "时尚日记", "职场", "搭配技巧", "/mock/discover-trench.svg", 547),
        ("休闲出街穿搭，舒适自在显高显瘦又洋气", "穿搭小灵感", "日常休闲", "潮流趋势", "/mock/discover-stripe.svg", 498),
        ("温柔风穿搭，春日氛围感拿捏了", "甜甜的穿搭本", "约会", "推荐", "/mock/discover-soft.svg", 693),
    ]
    db.add_all(
        [
            models.DiscoverPost(
                title=title,
                content=title,
                image_url=image_url,
                author_name=author,
                author_avatar_url="/mock/avatar-small.svg",
                scene=scene,
                channel=channel,
                like_count=likes,
                favorite_count=max(12, likes // 5),
            )
            for title, author, scene, channel, image_url, likes in posts
        ]
    )
    db.commit()


def add_tryon_record(db: Session, payload: dict[str, Any]) -> models.TryonRecord:
    record = models.TryonRecord(**payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.on_event("startup")
def startup_seed() -> None:
    db = next(get_db())
    try:
        seed_discover_posts(db)
    finally:
        db.close()


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    url = save_upload(file, "upload")
    return {"status": "success", "url": url}


@app.get("/")
def read_root():
    if "FRONTEND_INDEX" in globals() and FRONTEND_INDEX.is_file():
        return FileResponse(FRONTEND_INDEX)
    return {"message": "Welcome to Xieshang MVP API"}


@app.post("/api/session")
def create_session(payload: SessionPayload, db: Session = Depends(get_db)):
    user_id = payload.user_id or f"user_{str(uuid.uuid4())[:8]}"
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if not profile:
        profile = models.UserProfile(user_id=user_id)
        db.add(profile)

    clear_placeholder_profile_media(profile)
    profile.nickname = payload.nickname or profile.nickname or "小鹿酱"
    profile.gender = payload.gender or profile.gender or "female"
    profile.avatar_url = payload.avatar_url or profile.avatar_url or "/mock/avatar.svg"
    profile.updated_at = now()
    db.commit()
    db.refresh(profile)
    seed_user_content(db, user_id)
    return {"status": "success", "user": serialize_user(profile)}


@app.get("/api/profile/summary")
def profile_summary(user_id: str, db: Session = Depends(get_db)):
    profile = get_or_create_user(db, user_id)
    wardrobe_count = db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == user_id).count()
    outfit_count = db.query(models.Outfit).filter(models.Outfit.user_id == user_id).count()
    tryon_count = db.query(models.TryonRecord).filter(models.TryonRecord.user_id == user_id).count()
    favorite_count = (
        db.query(models.DiscoverInteraction)
        .filter(models.DiscoverInteraction.user_id == user_id, models.DiscoverInteraction.favorited.is_(True))
        .count()
    )
    category_counts: dict[str, int] = {}
    items = db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == user_id).all()
    for item in items:
        category_counts[item.category] = category_counts.get(item.category, 0) + 1
    latest_records = (
        db.query(models.TryonRecord)
        .filter(models.TryonRecord.user_id == user_id)
        .order_by(models.TryonRecord.created_at.desc())
        .limit(5)
        .all()
    )
    wardrobe_preview = (
        db.query(models.WardrobeItem)
        .filter(models.WardrobeItem.user_id == user_id)
        .order_by(models.WardrobeItem.created_at.desc())
        .limit(8)
        .all()
    )
    outfits_preview = (
        db.query(models.Outfit)
        .filter(models.Outfit.user_id == user_id)
        .order_by(models.Outfit.created_at.desc())
        .limit(4)
        .all()
    )

    return {
        "status": "success",
        "user": serialize_user(profile),
        "stats": {
            "tryon_count": tryon_count,
            "outfit_count": outfit_count,
            "wardrobe_count": wardrobe_count,
            "favorite_count": favorite_count,
            "category_counts": category_counts,
            "followed_shops": 12,
        },
        "latest_records": [serialize_record(record) for record in latest_records],
        "wardrobe_preview": [serialize_wardrobe(item) for item in wardrobe_preview],
        "outfits_preview": [serialize_outfit(outfit) for outfit in outfits_preview],
    }


@app.get("/api/wardrobe/items")
def list_wardrobe_items(
    user_id: str,
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = "latest",
    db: Session = Depends(get_db),
):
    get_or_create_user(db, user_id)
    query = db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == user_id)
    if category and category != "全部":
        query = query.filter(models.WardrobeItem.category == category)
    if q:
        query = query.filter(models.WardrobeItem.name.ilike(f"%{q}%"))
    query = query.order_by(models.WardrobeItem.created_at.asc() if sort == "oldest" else models.WardrobeItem.created_at.desc())
    return {"status": "success", "items": [serialize_wardrobe(item) for item in query.all()]}


@app.post("/api/wardrobe/items")
def create_wardrobe_item(user_id: str, payload: WardrobeItemPayload, db: Session = Depends(get_db)):
    get_or_create_user(db, user_id)
    item = models.WardrobeItem(user_id=user_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"status": "success", "item": serialize_wardrobe(item)}


@app.patch("/api/wardrobe/items/{item_id}")
def update_wardrobe_item(item_id: int, user_id: str, payload: WardrobeItemPatch, db: Session = Depends(get_db)):
    item = db.query(models.WardrobeItem).filter(models.WardrobeItem.id == item_id, models.WardrobeItem.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wardrobe item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    item.updated_at = now()
    db.commit()
    db.refresh(item)
    return {"status": "success", "item": serialize_wardrobe(item)}


@app.delete("/api/wardrobe/items/{item_id}")
def delete_wardrobe_item(item_id: int, user_id: str, db: Session = Depends(get_db)):
    item = db.query(models.WardrobeItem).filter(models.WardrobeItem.id == item_id, models.WardrobeItem.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wardrobe item not found")
    db.delete(item)
    db.commit()
    return {"status": "success"}


@app.get("/api/outfits")
def list_outfits(user_id: str, db: Session = Depends(get_db)):
    get_or_create_user(db, user_id)
    outfits = db.query(models.Outfit).filter(models.Outfit.user_id == user_id).order_by(models.Outfit.created_at.desc()).all()
    return {"status": "success", "outfits": [serialize_outfit(outfit) for outfit in outfits]}


def replace_outfit_items(db: Session, outfit: models.Outfit, item_ids: list[int]) -> None:
    outfit.items.clear()
    db.flush()
    if not item_ids:
        return
    items = db.query(models.WardrobeItem).filter(models.WardrobeItem.user_id == outfit.user_id, models.WardrobeItem.id.in_(item_ids)).all()
    for item in items:
        db.add(
            models.OutfitItem(
                outfit_id=outfit.id,
                wardrobe_item_id=item.id,
                name=item.name,
                category=item.category,
                image_url=item.image_url,
            )
        )


@app.post("/api/outfits")
def create_outfit(user_id: str, payload: OutfitPayload, db: Session = Depends(get_db)):
    get_or_create_user(db, user_id)
    outfit = models.Outfit(user_id=user_id, name=payload.name, scene=payload.scene, cover_url=payload.cover_url or "/mock/outfit-cover.svg")
    db.add(outfit)
    db.flush()
    replace_outfit_items(db, outfit, payload.item_ids)
    db.commit()
    db.refresh(outfit)
    return {"status": "success", "outfit": serialize_outfit(outfit)}


@app.patch("/api/outfits/{outfit_id}")
def update_outfit(outfit_id: int, user_id: str, payload: OutfitPatch, db: Session = Depends(get_db)):
    outfit = db.query(models.Outfit).filter(models.Outfit.id == outfit_id, models.Outfit.user_id == user_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    data = payload.model_dump(exclude_unset=True)
    for key in ("name", "scene", "cover_url"):
        if key in data:
            setattr(outfit, key, data[key])
    if data.get("item_ids") is not None:
        replace_outfit_items(db, outfit, data["item_ids"])
    outfit.updated_at = now()
    db.commit()
    db.refresh(outfit)
    return {"status": "success", "outfit": serialize_outfit(outfit)}


@app.delete("/api/outfits/{outfit_id}")
def delete_outfit(outfit_id: int, user_id: str, db: Session = Depends(get_db)):
    outfit = db.query(models.Outfit).filter(models.Outfit.id == outfit_id, models.Outfit.user_id == user_id).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    db.delete(outfit)
    db.commit()
    return {"status": "success"}


@app.get("/api/tryon-records")
def list_tryon_records(user_id: str, db: Session = Depends(get_db)):
    records = db.query(models.TryonRecord).filter(models.TryonRecord.user_id == user_id).order_by(models.TryonRecord.created_at.desc()).all()
    return {"status": "success", "records": [serialize_record(record) for record in records]}


@app.get("/api/discover/posts")
def list_discover_posts(
    user_id: str,
    channel: Optional[str] = None,
    scene: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    seed_discover_posts(db)
    query = db.query(models.DiscoverPost)
    if channel and channel != "推荐":
        query = query.filter(models.DiscoverPost.channel == channel)
    if scene and scene != "热门推荐":
        query = query.filter(models.DiscoverPost.scene == scene)
    if q:
        query = query.filter(models.DiscoverPost.title.ilike(f"%{q}%"))
    posts = query.order_by(models.DiscoverPost.created_at.desc()).all()
    interactions = {
        interaction.post_id: interaction
        for interaction in db.query(models.DiscoverInteraction).filter(models.DiscoverInteraction.user_id == user_id).all()
    }
    return {"status": "success", "posts": [serialize_discover_post(post, interactions.get(post.id)) for post in posts]}


def serialize_discover_post(post: models.DiscoverPost, interaction: Optional[models.DiscoverInteraction] = None) -> dict[str, Any]:
    tags = [value for value in [post.scene, post.channel, "灵感", "可试穿"] if value]
    return {
        "id": post.id,
        "title": post.title,
        "description": post.content or post.title,
        "content": post.content,
        "image_url": post.image_url,
        "author_name": post.author_name,
        "author_avatar_url": post.author_avatar_url or "/mock/avatar-small.svg",
        "scene": post.scene,
        "channel": post.channel,
        "tags": tags[:4],
        "like_count": post.like_count,
        "favorite_count": post.favorite_count,
        "is_liked": bool(interaction and interaction.liked),
        "is_favorited": bool(interaction and interaction.favorited),
        "created_at": dt(post.created_at),
    }


def toggle_discover_interaction(db: Session, post_id: int, user_id: str, field: str) -> dict[str, Any]:
    post = db.query(models.DiscoverPost).filter(models.DiscoverPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Discover post not found")
    interaction = (
        db.query(models.DiscoverInteraction)
        .filter(models.DiscoverInteraction.user_id == user_id, models.DiscoverInteraction.post_id == post_id)
        .first()
    )
    if not interaction:
        interaction = models.DiscoverInteraction(user_id=user_id, post_id=post_id)
        db.add(interaction)
        db.flush()
    current = bool(getattr(interaction, field))
    setattr(interaction, field, not current)
    if field == "liked":
        post.like_count = max(0, post.like_count + (1 if not current else -1))
    if field == "favorited":
        post.favorite_count = max(0, post.favorite_count + (1 if not current else -1))
    interaction.updated_at = now()
    db.commit()
    db.refresh(post)
    db.refresh(interaction)
    return serialize_discover_post(post, interaction)


@app.post("/api/discover/posts/{post_id}/like")
def toggle_like(post_id: int, payload: DiscoverActionPayload, db: Session = Depends(get_db)):
    return toggle_discover_interaction(db, post_id, payload.user_id, "liked")


@app.post("/api/discover/posts/{post_id}/favorite")
def toggle_favorite(post_id: int, payload: DiscoverActionPayload, db: Session = Depends(get_db)):
    return toggle_discover_interaction(db, post_id, payload.user_id, "favorited")


@app.websocket("/ws/process")
async def websocket_process(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        payload = json.loads(data)

        flow_type = payload.get("type")
        user_id = payload.get("user_id")

        if not flow_type or not user_id:
            await websocket.send_json({"status": "error", "message": "Missing type or user_id"})
            await websocket.close()
            return

        initial_state: dict[str, Any] = {}

        if flow_type == "onboarding":
            initial_state = {
                "user_id": user_id,
                "height": payload.get("height"),
                "weight": payload.get("weight"),
                "original_photo_url": payload.get("file_url"),
            }

        elif flow_type == "recommendation":
            query = payload.get("query")
            db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
            if db_profile and clear_placeholder_profile_media(db_profile):
                db.commit()
            if not db_profile or not db_profile.base_avatar_url:
                await websocket.send_json({"status": "error", "message": "请先完成形象固化。"})
                await websocket.close()
                return
            initial_state = {
                "user_id": user_id,
                "height": db_profile.height,
                "weight": db_profile.weight,
                "base_avatar_url": db_profile.base_avatar_url,
                "user_profile_tags": db_profile.user_profile_tags,
                "user_query": query,
            }

        elif flow_type == "direct-tryon":
            file_url = payload.get("file_url")
            db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
            if db_profile and clear_placeholder_profile_media(db_profile):
                db.commit()
            if not db_profile or not db_profile.base_avatar_url:
                await websocket.send_json({"status": "error", "message": "请先完成形象固化。"})
                await websocket.close()
                return
            initial_state = {
                "user_id": user_id,
                "base_avatar_url": db_profile.base_avatar_url,
                "user_profile_tags": db_profile.user_profile_tags or {},
                "uploaded_product_url": file_url,
            }
        else:
            await websocket.send_json({"status": "error", "message": "Unknown flow type"})
            await websocket.close()
            return

        final_result: dict[str, Any] = {}
        async for event in app_workflow.astream(initial_state, config={"configurable": {"thread_id": user_id}}):
            for node_name, state in event.items():
                await websocket.send_json({"status": "progress", "node": node_name})
                final_result.update(state)
                if state.get("error_message"):
                    await websocket.send_json({"status": "error", "message": str(state["error_message"])})
                    await websocket.close()
                    return

        if flow_type == "onboarding":
            error = workflow_error(final_result, ("base_avatar_url",))
            if error:
                await websocket.send_json({"status": "error", "message": error})
                await websocket.close()
                return
            db_profile = get_or_create_user(db, user_id)
            db_profile.height = final_result.get("height", initial_state.get("height"))
            db_profile.weight = final_result.get("weight", initial_state.get("weight"))
            db_profile.original_photo_url = final_result.get("original_photo_url", initial_state.get("original_photo_url"))
            db_profile.base_avatar_url = final_result.get("base_avatar_url")
            db_profile.avatar_url = db_profile.base_avatar_url or db_profile.avatar_url
            db_profile.user_profile_tags = final_result.get("user_profile_tags")
            db_profile.updated_at = now()
            db.commit()

            add_tryon_record(
                db,
                {
                    "user_id": user_id,
                    "type": "onboarding",
                    "input_photo_url": db_profile.original_photo_url,
                    "final_tryon_url": db_profile.base_avatar_url,
                },
            )
            await websocket.send_json({"status": "success", "avatar_url": db_profile.base_avatar_url})

        elif flow_type == "recommendation":
            error = workflow_error(final_result, ("generated_product_url", "final_tryon_url"))
            if error:
                await websocket.send_json({"status": "error", "message": error})
                await websocket.close()
                return
            record = add_tryon_record(
                db,
                {
                    "user_id": user_id,
                    "type": "recommendation",
                    "scene": initial_state.get("user_query"),
                    "product_url": final_result.get("generated_product_url"),
                    "styling_suggestion": final_result.get("styling_suggestion"),
                    "generated_product_url": final_result.get("generated_product_url"),
                    "final_tryon_url": final_result.get("final_tryon_url"),
                },
            )
            await websocket.send_json(
                {
                    "status": "success",
                    "record_id": record.id,
                    "styling_suggestion": final_result.get("styling_suggestion"),
                    "generated_product_url": final_result.get("generated_product_url"),
                    "final_tryon_url": final_result.get("final_tryon_url"),
                }
            )

        elif flow_type == "direct-tryon":
            error = workflow_error(final_result, ("final_tryon_url",))
            if error:
                await websocket.send_json({"status": "error", "message": error})
                await websocket.close()
                return
            product_url = initial_state.get("uploaded_product_url")
            record = add_tryon_record(
                db,
                {
                    "user_id": user_id,
                    "type": "direct_tryon",
                    "scene": payload.get("scene"),
                    "product_url": product_url,
                    "final_tryon_url": final_result.get("final_tryon_url"),
                },
            )
            if payload.get("save_to_wardrobe") and product_url:
                item = models.WardrobeItem(
                    user_id=user_id,
                    name=payload.get("item_name") or "新上传服装",
                    category=payload.get("category") or "上衣",
                    image_url=product_url,
                    source="tryon-upload",
                    tags=[payload.get("scene")] if payload.get("scene") else [],
                )
                db.add(item)
                db.commit()
            await websocket.send_json({"status": "success", "record_id": record.id, "final_tryon_url": final_result.get("final_tryon_url")})

        await websocket.close()

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
            await websocket.close()
        except Exception:
            pass


@app.post("/api/onboarding")
async def onboarding_flow(
    user_id: str = Form(...),
    height: int = Form(...),
    weight: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    original_photo_url = save_upload(file, f"{user_id}_onboarding")
    initial_state = {"user_id": user_id, "height": height, "weight": weight, "original_photo_url": original_photo_url}
    result = await app_workflow.ainvoke(initial_state, config={"configurable": {"thread_id": user_id}})
    error = workflow_error(result, ("base_avatar_url",))
    if error:
        raise HTTPException(status_code=502, detail=error)

    db_profile = get_or_create_user(db, user_id)
    db_profile.height = result.get("height", height)
    db_profile.weight = result.get("weight", weight)
    db_profile.original_photo_url = result.get("original_photo_url", original_photo_url)
    db_profile.base_avatar_url = result.get("base_avatar_url")
    db_profile.avatar_url = db_profile.base_avatar_url or db_profile.avatar_url
    db_profile.user_profile_tags = result.get("user_profile_tags")
    db_profile.updated_at = now()
    db.commit()
    db.refresh(db_profile)

    add_tryon_record(db, {"user_id": user_id, "type": "onboarding", "input_photo_url": original_photo_url, "final_tryon_url": db_profile.base_avatar_url})
    return {"status": "success", "avatar_url": db_profile.base_avatar_url}


@app.post("/api/recommendation")
async def ai_styling_tryon_flow(user_id: str = Form(...), query: str = Form(...), db: Session = Depends(get_db)):
    db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if db_profile and clear_placeholder_profile_media(db_profile):
        db.commit()
    if not db_profile or not db_profile.base_avatar_url:
        raise HTTPException(status_code=400, detail="User profile not initialized. Please complete onboarding first.")

    initial_state = {
        "user_id": user_id,
        "height": db_profile.height,
        "weight": db_profile.weight,
        "base_avatar_url": db_profile.base_avatar_url,
        "user_profile_tags": db_profile.user_profile_tags,
        "user_query": query,
    }
    result = await app_workflow.ainvoke(initial_state, config={"configurable": {"thread_id": user_id}})
    error = workflow_error(result, ("generated_product_url", "final_tryon_url"))
    if error:
        raise HTTPException(status_code=502, detail=error)
    record = add_tryon_record(
        db,
        {
            "user_id": user_id,
            "type": "recommendation",
            "scene": query,
            "product_url": result.get("generated_product_url"),
            "styling_suggestion": result.get("styling_suggestion"),
            "generated_product_url": result.get("generated_product_url"),
            "final_tryon_url": result.get("final_tryon_url"),
        },
    )
    return {
        "status": "success",
        "record_id": record.id,
        "styling_suggestion": result.get("styling_suggestion"),
        "generated_product_url": result.get("generated_product_url"),
        "final_tryon_url": result.get("final_tryon_url"),
    }


@app.post("/api/direct-tryon")
async def direct_product_tryon_flow(user_id: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if db_profile and clear_placeholder_profile_media(db_profile):
        db.commit()
    if not db_profile or not db_profile.base_avatar_url:
        raise HTTPException(status_code=400, detail="User profile not initialized. Please complete onboarding first.")

    uploaded_product_url = save_upload(file, f"{user_id}_product")
    initial_state = {
        "user_id": user_id,
        "base_avatar_url": db_profile.base_avatar_url,
        "user_profile_tags": db_profile.user_profile_tags or {},
        "uploaded_product_url": uploaded_product_url,
    }
    result = await app_workflow.ainvoke(initial_state, config={"configurable": {"thread_id": user_id}})
    error = workflow_error(result, ("final_tryon_url",))
    if error:
        raise HTTPException(status_code=502, detail=error)
    record = add_tryon_record(
        db,
        {
            "user_id": user_id,
            "type": "directTryon",
            "product_url": uploaded_product_url,
            "final_tryon_url": result.get("final_tryon_url"),
        },
    )
    return {"status": "success", "record_id": record.id, "final_tryon_url": result.get("final_tryon_url")}


def frontend_dist_dir() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "frontend_dist"
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


FRONTEND_DIST = frontend_dist_dir()
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

if FRONTEND_INDEX.is_file():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        requested = (FRONTEND_DIST / full_path).resolve()
        if requested.is_file() and (requested == FRONTEND_DIST.resolve() or FRONTEND_DIST.resolve() in requested.parents):
            return FileResponse(requested)
        return FileResponse(FRONTEND_INDEX)
