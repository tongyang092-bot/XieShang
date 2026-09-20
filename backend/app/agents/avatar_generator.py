import asyncio
from pathlib import Path
import dashscope
from app.core.state import XieshangState
from app.core.config import settings
from app.core.media import persist_remote_image

dashscope.api_key = settings.DASHSCOPE_API_KEY or settings.ALIYUN_API_KEY
dashscope.base_http_api_url = settings.DASHSCOPE_BASE_HTTP_API_URL

async def avatar_generator_node(state: XieshangState) -> dict:
    """
    形象固化 Agent：结合半身照与身高体重，调用阿里图像生成模型生成全身基底照。
    """
    height = state.get('height', 170)
    weight = state.get('weight', 60)
    user_id = state.get('user_id')
    tags = state.get('user_profile_tags') or {}
    
    photo_url = state.get('original_photo_url')
    import os
    if photo_url:
        file_name = photo_url.split('/')[-1]
        local_file_path = os.path.abspath(os.path.join("uploads", file_name))
        file_uri = Path(local_file_path).resolve().as_uri()
    else:
        file_uri = None

    print(f"--> [Avatar Generator] 正在为用户 {user_id} 生成标准全身像 (身高:{height}, 体重:{weight}, 标签:{tags})")
    
    # 构造生图 Prompt，现在支持图生图
    prompt = f"请根据这张半身照生成一张全身照。模特身高大约{height}cm，体重约{weight}kg，体型为{tags.get('body_shape', '匀称')}，肤色为{tags.get('skin_tone', '中性')}。人物双臂自然微微展开，展示身上穿着的衣服。人物穿着：白色短袖 T 恤 + 黑色短裤+小白鞋，站姿自然、比例正常、画面完整、细节清晰、画风干净美观。"
    
    # 构造请求消息
    messages = [
        {
            "role": "user",
            "content": []
        }
    ]
    
    if file_uri:
        messages[0]["content"].append({"image": file_uri})
        
    messages[0]["content"].append({"text": prompt})
    
    def call_api():
        return dashscope.MultiModalConversation.call(
            model='qwen-image-2.0',
            messages=messages
        )
        
    try:
        response = await asyncio.to_thread(call_api)
        if response.status_code == 200:
            # MultiModalConversation 返回结构不同
            if response.output and response.output.choices:
                base_avatar_url = response.output.choices[0].message.content[0].get('image')
                if base_avatar_url:
                    print(f"--> [Avatar Generator] 生图成功: {base_avatar_url}")
                    try:
                        base_avatar_url = await persist_remote_image(base_avatar_url, f"{user_id}_avatar")
                    except Exception as persist_error:
                        print(f"--> [Avatar Generator] 本地保存失败，暂用远程地址: {persist_error}")
                    return {"base_avatar_url": base_avatar_url}
            raise Exception(f"No results returned. Output: {response.output}")
        else:
            raise Exception(response.message)
    except Exception as e:
        print(f"--> [Avatar Generator] 发生错误: {str(e)}")
        if photo_url:
            return {
                "base_avatar_url": photo_url,
                "warning_message": f"基础形象生成失败，已使用原始上传照片：{str(e)}",
            }
        return {"error_message": f"基础形象生成失败：{str(e)}"}
