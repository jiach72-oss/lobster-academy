# MirrorAI × LlamaIndex Integration

[![PyPI](https://img.shields.io/pypi/v/lobster-academy-llamaindex)](https://pypi.org/project/lobster-academy-llamaindex/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

将 LlamaIndex 的每一次 LLM 调用、检索、合成自动记录为可验证的行为证据。

## 安装

```bash
pip install lobster-academy-llamaindex
```

## 快速开始

### 示例 1：基础 RAG 查询录制

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.callbacks import CallbackManager
from lobster_academy_llamaindex import LobsterLlamaIndexHandler

# 创建 Lobster handler
handler = LobsterLlamaIndexHandler(agent_id="rag-query-agent")

# 加载文档并创建索引
documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(
    documents,
    callback_manager=CallbackManager([handler]),
)

# 查询 — 所有事件自动录制
query_engine = index.as_query_engine()
response = query_engine.query("什么是量子计算？")
print(response)

# 查看录制的事件
for event in handler.storage.records:
    print(f"[{event['event_type']}] {event.get('payload', {})}")
```

### 示例 2：Agent 工具调用录制

```python
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import FunctionTool
from llama_index.core.callbacks import CallbackManager
from llama_index.llms.openai import OpenAI
from lobster_academy_llamaindex import LobsterLlamaIndexHandler

# 定义工具
def multiply(a: int, b: int) -> int:
    """Multiply two integers and return the result."""
    return a * b

def add(a: int, b: int) -> int:
    """Add two integers and return the result."""
    return a + b

# 创建 handler
handler = LobsterLlamaIndexHandler(agent_id="math-agent")

# 创建 Agent
agent = ReActAgent.from_tools(
    tools=[
        FunctionTool.from_defaults(fn=multiply),
        FunctionTool.from_defaults(fn=add),
    ],
    llm=OpenAI(model="gpt-4"),
    callback_manager=CallbackManager([handler]),
    verbose=True,
)

# 运行 Agent
response = agent.chat("What is (123 * 456) + 789?")
print(response)
```

### 示例 3：自定义 Redactor + 过滤事件类型

```python
from lobster_academy_llamaindex import LobsterLlamaIndexHandler
from llama_index.core.callbacks.schema import CBEventType

# 只记录 LLM 和 Query 事件，忽略 Embedding/Chunking
handler = LobsterLlamaIndexHandler(
    agent_id="filtered-agent",
    event_starts_to_ignore=[
        CBEventType.EMBEDDING,
        CBEventType.CHUNKING,
        CBEventType.NODE_PARSING,
    ],
    event_ends_to_ignore=[
        CBEventType.EMBEDDING,
        CBEventType.CHUNKING,
        CBEventType.NODE_PARSING,
    ],
    verbose=True,
)
```

## API 参考

### LobsterLlamaIndexHandler

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agent_id` | `str` | 自动生成 | Agent 唯一标识 |
| `redactor` | `Redactor` | 默认实例 | 数据脱敏器 |
| `storage` | `Storage` | 内存存储 | 事件持久化后端 |
| `event_starts_to_ignore` | `list` | `[]` | 忽略的开始事件类型 |
| `event_ends_to_ignore` | `list` | `[]` | 忽略的结束事件类型 |
| `verbose` | `bool` | `False` | 打印事件到 stdout |

### 支持的事件类型

| LlamaIndex 事件 | Lobster 事件名 | 说明 |
|-----------------|----------------|------|
| `LLM` | `llmStart` / `llmEnd` | LLM 调用 |
| `EMBEDDING` | `embeddingStart` / `embeddingEnd` | 向量嵌入 |
| `RETRIEVE` | `retrieveStart` / `retrieveEnd` | 文档检索 |
| `QUERY` | `queryStart` / `queryEnd` | 查询执行 |
| `SYNTHESIZE` | `synthesizeStart` / `synthesizeEnd` | 响应合成 |
| `AGENT_STEP` | `agentStepStart` / `agentStepEnd` | Agent 步骤 |
| `FUNCTION_CALL` | `functionCallStart` / `functionCallEnd` | 函数调用 |
| `RERANKING` | `rerankingStart` / `rerankingEnd` | 重排序 |

## License

Apache-2.0
