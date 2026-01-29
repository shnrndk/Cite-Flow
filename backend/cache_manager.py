import os
import joblib
from typing import Any, Optional

CACHE_DIR = "cache_data"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

memory = joblib.Memory(CACHE_DIR, verbose=0)

@memory.cache
def cached_request(func, *args, **kwargs):
    """
    Wrapper to cache function calls. 
    However, joblib decorates functions directly.
    We will expose a decorator or just use this file to configure the memory object.
    """
    return func(*args, **kwargs)

def get_memory():
    return memory
