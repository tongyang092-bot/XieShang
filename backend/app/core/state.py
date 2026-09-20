from typing import TypedDict, Optional, List, Dict, Any

class XieshangState(TypedDict):
    """
    Xieshang MVP 的 LangGraph 全局状态
    """
    user_id: str
    
    # --- 用户形象固化特征 ---
    height: Optional[int]
    weight: Optional[int]
    original_photo_url: Optional[str] # 用户上传的基底照片（如半身照）
    base_avatar_url: Optional[str]    # 阿里大模型生成的标准全身形象照
    user_profile_tags: Optional[Dict[str, Any]] # 体型、肤色等分析结果
    
    # --- 动态会话特征 ---
    user_query: Optional[str]         # 用户的穿搭场景需求
    uploaded_product_url: Optional[str] # 用户指定试穿的商品图
    
    # --- Agent 输出 ---
    styling_suggestion: Optional[str] # 穿搭建议文本
    generated_product_url: Optional[str] # AI生成的商品白底图
    
    # --- 最终输出 ---
    final_tryon_url: Optional[str]    # 虚拟试穿合成结果
    error_message: Optional[str]      # 错误信息
    warning_message: Optional[str]    # 降级处理提示
