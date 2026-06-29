"""Data subpackage marker.

Exists so ``importlib.resources.files('app.core.ai_opponent.grandmaster.data')``
resolves robustly, including inside a zipped wheel. Holds the committed
``strategy_table.json`` build artifact.
"""
