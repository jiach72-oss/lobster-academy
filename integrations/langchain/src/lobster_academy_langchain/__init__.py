"""Lobster Academy LangChain Integration.

Provides a CallbackHandler that automatically records AI Agent behavior
for evidence capture in Lobster Academy.
"""

from lobster_academy_langchain.callback import LobsterCallbackHandler
from lobster_academy_langchain.tool_wrapper import LobsterToolWrapper

__all__ = ["LobsterCallbackHandler", "LobsterToolWrapper"]
__version__ = "0.1.0"
