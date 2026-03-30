# MirrorAI Integrations

MirrorAI 的框架集成插件，让主流 AI 框架的行为自动录制只需一行代码。

## 可用集成

| 集成 | 包名 | 安装 | 状态 |
|------|------|------|------|
| [LangChain](./langchain/) | `lobster-academy-langchain` | `pip install lobster-academy-langchain` | ✅ 可用 |
| [LlamaIndex](./llamaindex/) | `lobster-academy-llamaindex` | `pip install lobster-academy-llamaindex` | ✅ 可用 |

## 设计原则

1. **零侵入** — 只需传入 callback handler，不修改业务代码
2. **自动脱敏** — 所有数据经过 Redactor 处理后才存储
3. **可选粒度** — 可选择性开启/关闭不同事件类型的录制
4. **统一接口** — 所有集成使用相同的 `Redactor` 和 `Storage` 接口

## 架构

```
┌─────────────────────────────────────────────────────┐
│                    用户应用代码                        │
│  agent.invoke(...)  /  query_engine.query(...)       │
└───────────────────────┬─────────────────────────────┘
                        │ callbacks
                        ▼
┌─────────────────────────────────────────────────────┐
│             集成层 (langchain / llamaindex)           │
│  LobsterCallbackHandler / LobsterLlamaIndexHandler   │
│  - 捕获事件 → 脱敏 → 记录                            │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                  MirrorAI Core                │
│  Redactor (脱敏)  +  Storage (持久化)                 │
└─────────────────────────────────────────────────────┘
```

## 快速开始

### LangChain

```python
from langchain.agents import initialize_agent, load_tools
from langchain.chat_models import ChatOpenAI
from lobster_academy_langchain import LobsterCallbackHandler

handler = LobsterCallbackHandler(agent_id="my-agent")
agent = initialize_agent(
    tools=load_tools(["serpapi"]),
    llm=ChatOpenAI(),
    callbacks=[handler],
)
agent.invoke({"input": "今天的新闻"})
```

### LlamaIndex

```python
from llama_index.core import VectorStoreIndex
from llama_index.core.callbacks import CallbackManager
from lobster_academy_llamaindex import LobsterLlamaIndexHandler

handler = LobsterLlamaIndexHandler(agent_id="rag-agent")
index = VectorStoreIndex.from_documents(
    documents,
    callback_manager=CallbackManager([handler]),
)
response = index.as_query_engine().query("问题")
```

## 开发

```bash
# LangChain 集成
cd langchain
pip install -e ".[dev]"
pytest tests/

# LlamaIndex 集成
cd llamaindex
pip install -e ".[dev]"
pytest tests/
```

## 计划中的集成

- [ ] OpenAI SDK (openai-python)
- [ ] Anthropic SDK
- [ ] CrewAI
- [ ] AutoGen
- [ ] Semantic Kernel

## License

Apache-2.0
