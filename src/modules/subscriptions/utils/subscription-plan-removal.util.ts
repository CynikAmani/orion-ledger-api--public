export function decidePlanRemoval(
  referenceCount: number,
): 'delete' | 'deactivate' {
  return referenceCount > 0 ? 'deactivate' : 'delete';
}
