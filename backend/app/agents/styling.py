import asyncio
import json
import dashscope
from app.core.state import XieshangState
from app.core.config import settings
from app.core.media import persist_remote_image

dashscope.api_key = settings.DASHSCOPE_API_KEY or settings.ALIYUN_API_KEY
dashscope.base_http_api_url = settings.DASHSCOPE_BASE_HTTP_API_URL

async def styling_node(state: XieshangState) -> dict:
    """
    穿搭推理 Agent：基于用户场景需求和固化标签，调用 Qwen-Plus 生成穿搭描述。
    并提取商品关键词，调用通义万相生成白底商品图。
    """
    user_query = state.get("user_query", "随便推荐")
    tags = state.get("user_profile_tags") or {}
    user_id = state.get("user_id")
    
    print(f"--> [Styling Worker] 分析需求: '{user_query}'，结合用户特征: {tags}")
    
    # 1. 文本推理 (Qwen-Plus)
    text_prompt = f"""
用户场景需求: "{user_query}"
用户的体型是: {tags.get('body_shape', '匀称')}
肤色是: {tags.get('skin_tone', '中性')}
风格偏好是: {tags.get('style_preference', '随意')}

请作为专业的穿搭顾问，为用户推荐一套最合适的服装。
输出要求：
请务必返回一个合法的 JSON 字符串，包含两个字段：
1. "suggestion": 给用户的建议文本，2-3句话。
2. "image_prompt": 用来生成这套服装（不含模特，白底图）的英文 AI 绘图提示词，描述要具体到颜色、款式、材质。
"""
    def call_qwen():
        return dashscope.Generation.call(
            model='qwen-plus',
            prompt=text_prompt,
            result_format='json'
        )
    
    try:
        qwen_resp = await asyncio.to_thread(call_qwen)
        if qwen_resp.status_code == 200:
            content = qwen_resp.output.choices[0].message.content
            # json 解析
            result_dict = json.loads(content)
            suggestion = result_dict.get('suggestion', "这是一套为您精心挑选的穿搭。")
            image_prompt = result_dict.get('image_prompt', "A stylish dress on a white background, studio lighting, high resolution")
        else:
            raise Exception(qwen_resp.message)
            
        print(f"--> [Styling Worker] 穿搭建议生成成功: {suggestion}")
        
        # 2. 生成商品白底图 (Wanx-V1)
        # 添加一些限定词确保是白底商品图
        full_image_prompt = f"Product photography, clothing on white background, no model, {image_prompt}"
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"text": full_image_prompt}
                ]
            }
        ]
        
        def call_wanx():
            return dashscope.MultiModalConversation.call(
                model='qwen-image-2.0',
                messages=messages
            )
            
        wanx_resp = await asyncio.to_thread(call_wanx)
        if wanx_resp.status_code == 200:
            if wanx_resp.output and wanx_resp.output.choices:
                generated_product_url = wanx_resp.output.choices[0].message.content[0].get('image')
                if generated_product_url:
                    print(f"--> [Styling Worker] 商品图生成成功: {generated_product_url}")
                    try:
                        generated_product_url = await persist_remote_image(generated_product_url, f"{user_id}_product")
                    except Exception as persist_error:
                        print(f"--> [Styling Worker] 本地保存失败，暂用远程地址: {persist_error}")
                    return {
                        "styling_suggestion": suggestion,
                        "generated_product_url": generated_product_url
                    }
            raise Exception(f"No results returned. Output: {wanx_resp.output}")
        else:
            raise Exception(wanx_resp.message)
            
    except Exception as e:
        print(f"--> [Styling Worker] 发生错误: {str(e)}")
        return {"error_message": f"穿搭方案生成失败：{str(e)}"}
