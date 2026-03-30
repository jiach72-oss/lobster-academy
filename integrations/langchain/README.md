# Lobster Academy × LangChain Integration

[![PyPI](https://img.shields.io/pypi/v/lobster-academy-langchain)](https://pypi.org/project/lobster-academy-langchain/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

将 LangChain Agent 的每一次决策、工具调用、LLM 请求自动记录为可验证的行为证据。

## 安装

```bash
pip install lobster-academy-langchain
```

## 快速开始

### 示例 1：基础用法 — 使用 CallbackHandler

```python
from langchain.chat_models import ChatOpenAI
from langchain.agents import AgentType, initialize_agent, load_tools
from lobster_academy_langchain import LobsterCallbackHandler

# 创建 Lobster 回调
handler = LobsterCallbackHandler(agent_id="my-research-agent")

# 创建 Agent
llm = ChatOpenAI(temperature=0, model="gpt-4")
tools = load_tools(["serpapi", "llm-math"], llm=llm)

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    callbacks=[handler],  # 传入 handler 即可！
)

# 运行 Agent — 所有行为自动录制
result = agent.invoke({"input": "今天上海的天气怎么样？温度是多少华氏度？"})
print(result)

# 查看录制的事件
for event in handler.storage.records:
    print(f"[{event['event_type']}] {event.get('tool_name', event.get('chain_name', '—'))}")
```

### 示例 2：工具包装 — 精细控制

```python
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent
from langchain.chat_models import ChatOpenAI
from lobster_academy_langchain import LobsterToolWrapper, LobsterCallbackHandler

# 定义自定义工具
def search_database(query: str) -> str:
    """搜索内部数据库。"""
    return f"找到关于 '{query}' 的 3 条记录"

def send_email(content: str) -> str:
    """发送邮件。"""
    return f"邮件已发送: {content[:50]}..."

# 包装工具（自动脱敏入参和返回值）
wrapper = LobsterToolWrapper(agent_id="crm-agent")

db_tool = wrapper.wrap(Tool(
    name="search_database",
    description="搜索内部数据库",
    func=search_database,
))

email_tool = wrapper.wrap(Tool(
    name="send_email",
    description="发送邮件",
    func=send_email,
))

# 同时使用 CallbackHandler 记录 Agent 级别事件
handler = LobsterCallbackHandler(agent_id="crm-agent")

llm = ChatOpenAI(temperature=0)
agent = initialize_agent(
    tools=[db_tool, email_tool],
    llm=llm,
    agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    callbacks=[handler],
)

result = agent.invoke({"input": "查找张三的联系方式并发送会议邀请"})
```

### 示例 3：自定义 Redactor 和 Storage

```python
from lobster_academy_langchain import LobsterCallbackHandler

# 假设你有自定义的 Redactor 和 Storage
from lobster_academy import Redactor, Storage

# 自定义脱敏规则
redactor = Redactor(
    patterns=[
        r'\b1[3-9]\d{9}\b',      # 手机号
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # 邮箱
    ],
    replacement="[REDACTED]"
)

# 自定义存储（例如写入文件或数据库）
storage = Storage(
    backend="file",
    path="./lobster_records.jsonl"
)

handler = LobsterCallbackHandler(
    agent_id="production-agent-v2",
    redactor=redactor,
    storage=storage,
    record_llm=True,
    record_chain=True,
    record_tool=True,
    record_agent=True,
    verbose=True,  # 打印事件到 stdout
)

# 使用 handler 创建你的 Agent...
```

## API 参考

### LobsterCallbackHandler

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agent_id` | `str` | 自动生成 | Agent 唯一标识 |
| `redactor` | `Redactor` | 默认实例 | 数据脱敏器 |
| `storage` | `Storage` | 内存存储 | 事件持久化后端 |
| `record_llm` | `bool` | `True` | 是否记录 LLM 调用 |
| `record_chain` | `bool` | `True` | 是否记录 Chain 执行 |
| `record_tool` | `bool` | `True` | 是否记录 Tool 调用 |
| `record_agent` | `bool` | `True` | 是否记录 Agent 行为 |
| `verbose` | `bool` | `False` | 打印事件到 stdout |

### LobsterToolWrapper

| 方法 | 说明 |
|------|------|
| `wrap(tool)` | 包装单个 BaseTool |
| `wrap_tool(tool, ...)` | 类方法，便捷包装单个工具 |
| `wrap_tools(tools, ...)` | 类方法，批量包装工具列表 |
| `wrap_tool_function(func, ...)` | 从普通函数创建并包装工具 |

### 事件类型

| 事件类型 | 触发时机 |
|----------|----------|
| `chainStart` / `chainEnd` / `chainError` | Chain 执行 |
| `toolStart` / `toolEnd` / `toolError` | 工具调用 |
| `llmStart` / `llmEnd` / `llmError` | LLM 请求 |
| `agentAction` / `agentFinish` | Agent 决策 |
| `retrieverStart` / `retrieverEnd` | 检索器调用 |
| `chatModelStart` / `chatModelEnd` | Chat Model 调用 |

## License

Apache-2.0
