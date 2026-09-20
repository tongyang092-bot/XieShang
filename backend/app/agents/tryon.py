import asyncio
from pathlib import Path
from urllib.parse import urlparse
import dashscope
from dashscope.aigc.image_generation import ImageGeneration
from dashscope.api_entities.dashscope_response import Message
from app.core.state import XieshangState
from app.core.config import settings
from app.core.media import persist_remote_image

dashscope.api_key = settings.DASHSCOPE_API_KEY or settings.ALIYUN_API_KEY
dashscope.base_http_api_url = settings.DASHSCOPE_BASE_HTTP_API_URL

async def tryon_node(state: XieshangState) -> dict:
    """
    虚拟试穿 Agent：接收商品图(不论是 AI 生成还是用户上传)和基底全身照，调用图像融合模型。
    MVP 阶段直接调用万相生图模拟。
    """
    base_avatar = state.get("base_avatar_url")
    user_id = state.get("user_id")
    
    # 优先使用用户手动上传的商品图，否则使用 AI 生成的商品图
    target_garment = state.get("uploaded_product_url") or state.get("generated_product_url")
    
    print(f"--> [Try-On Worker] 开始融合试穿. \n人物图: {base_avatar}\n商品图: {target_garment}")
    
    if not base_avatar or not target_garment:
        return {"error_message": "试穿必须提供人物全身像和目标服装图片"}
    
    prompt = """
任务：高保真局部服装替换。

输入说明：
- 图1是目标服装参考图，只用于读取服装的款式、颜色、材质、纹理和剪裁。
- 图2是人物基础图，是输出画面的唯一底图，也是人物身份、构图、光线和色彩的唯一基准。

编辑要求：
1. 只把图1中的服装自然地穿到图2人物身上，只修改图2中原服装覆盖的区域及服装边缘必要的遮挡关系。
2. 严格保留图2人物的脸部和五官，不重新生成脸，不美颜，不磨皮，不改变表情。
3. 严格保留图2人物原有肤色、发色、发型、身体比例、体型、姿势、手势、腿部和鞋子。
4. 严格保留图2的背景、构图、裁切、相机视角、景深、阴影方向和环境细节。
5. 严格保留图2的曝光、白平衡、色温、对比度、饱和度和整体色调；不得重新打光、不得添加滤镜、不得风格化。
6. 图1只影响服装本身，不得把图1的背景、光线、色调、模特或构图迁移到图2。
7. 新服装要贴合图2人物原有姿势，褶皱、遮挡和边缘自然真实，同时保持服装在图1中的准确颜色与材质。

输出必须看起来像在图2原照片上仅替换了服装。除服装区域外，其余画面应与图2保持一致。
""".strip()
    
    # 将URL转换为DashScope要求的file://协议（如果是本地文件的话）
    import os
    
    def get_file_uri(url):
        parsed = urlparse(url)
        if parsed.hostname in {"localhost", "127.0.0.1"} and "/uploads/" in parsed.path:
            file_name = os.path.basename(parsed.path)
            upload_dir = os.getenv("XIESHANG_UPLOAD_DIR", "uploads")
            local_file_path = os.path.abspath(os.path.join(upload_dir, file_name))
            return Path(local_file_path).resolve().as_uri()
        return url
        
    base_avatar_uri = get_file_uri(base_avatar)
    target_garment_uri = get_file_uri(target_garment)
    
    message = Message(
        role="user",
        content=[
            {"image": target_garment_uri},
            {"image": base_avatar_uri},
            {"text": prompt},
        ],
    )
    
    def call_wanx():
        return ImageGeneration.call(
            model=settings.TRYON_MODEL,
            messages=[message],
            size="2K",
            n=1,
            watermark=False,
        )
        
    try:
        wanx_resp = await asyncio.to_thread(call_wanx)
        if wanx_resp.status_code == 200:
            if wanx_resp.output and wanx_resp.output.choices:
                final_tryon_url = wanx_resp.output.choices[0].message.content[0].get('image')
                if final_tryon_url:
                    print(f"--> [Try-On Worker] 试穿生成成功: {final_tryon_url}")
                    try:
                        final_tryon_url = await persist_remote_image(final_tryon_url, f"{user_id}_tryon")
                    except Exception as persist_error:
                        print(f"--> [Try-On Worker] 本地保存失败，暂用远程地址: {persist_error}")
                    return {"final_tryon_url": final_tryon_url}
            raise Exception(f"No results returned. Output: {wanx_resp.output}")
        else:
            raise Exception(wanx_resp.message)
    except Exception as e:
        print(f"--> [Try-On Worker] 发生错误: {str(e)}")
        return {"error_message": f"虚拟试穿生成失败：{str(e)}"}
