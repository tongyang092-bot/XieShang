import json
from pathlib import Path
from app.core.state import XieshangState
import asyncio
import dashscope
from app.core.config import settings

dashscope.api_key = settings.DASHSCOPE_API_KEY or settings.ALIYUN_API_KEY
dashscope.base_http_api_url = settings.DASHSCOPE_BASE_HTTP_API_URL

async def profiling_node(state: XieshangState) -> dict:
    """
    视觉感知 Agent：调用 qwen-omni-turbo分析用户基底照，提取体型、肤色等标签。
    """
    photo_url = state.get('original_photo_url')
    # 对于 DashScope 必须是公网URL或本地 file:// 协议，我们将其转换为本地绝对路径
    # photo_url 格式形如: http://localhost:8000/uploads/test_user_onboarding_xxx.jpg
    file_name = photo_url.split('/')[-1]
    import os
    local_file_path = os.path.abspath(os.path.join("uploads", file_name))
    file_uri = Path(local_file_path).resolve().as_uri()
    
    print(f"--> [Profiling Worker] 正在分析用户 {state['user_id']} 的照片: {file_uri}")
    
    # 构造请求消息
    messages = [
        {
            "role": "user",
            "content": [
                {"image": file_uri},
                {"text": "请分析这张照片中人物的特征，提取并仅输出以下 JSON 格式（不要输出 markdown 代码块或其他文字）：\n{\"body_shape\": \"(如：沙漏型/梨形/苹果型/匀称型等)\", \"skin_tone\": \"(如：暖黄皮/冷白皮/中性肤色等)\", \"style_preference\": \"(根据穿着推测，如：法式优雅/休闲运动/日系复古等)\"}"}
            ]
        }
    ]
    
    # 异步调用 DashScope，此处使用 asyncio.to_thread
    def call_api():
        return dashscope.MultiModalConversation.call(
            model='qwen3.5-omni-plus', 
            messages=messages
        )
        
    try:
        response = await asyncio.to_thread(call_api)
        if response.status_code == 200:
            content = response.output.choices[0].message.content[0]['text']
            # 清理可能的 markdown 代码块标记
            content = content.replace("```json", "").replace("```", "").strip()
            profile_tags = json.loads(content)
            print(f"--> [Profiling Worker] 提取特征成功: {profile_tags}")
            return {"user_profile_tags": profile_tags}
        else:
            print(f"--> [Profiling Worker] API调用失败: {response.message}")
            return {"error_message": response.message}
    except Exception as e:
        print(f"--> [Profiling Worker] 发生错误: {str(e)}")
        # 降级返回 Mock 数据
        profile_tags = {
            "body_shape": "匀称型",
            "skin_tone": "中性肤色",
            "style_preference": "简约百搭"
        }
        return {"user_profile_tags": profile_tags}
