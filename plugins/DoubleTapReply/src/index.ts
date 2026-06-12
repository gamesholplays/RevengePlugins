// Walk the fiber tree to find TextInput nodes
function findTextInputs(fiber, results = [], depth = 0) {
  if (!fiber || depth > 50) return results;
  if (fiber.stateNode && fiber.stateNode.focus && fiber.type?.displayName?.includes("TextInput")) {
    results.push({ depth, type: fiber.type?.displayName, tag: fiber.stateNode });
  }
  if (fiber.memoizedProps?.onChangeText && fiber.stateNode?.focus) {
    results.push({ depth, keys: Object.keys(fiber.memoizedProps).join(",") });
  }
  findTextInputs(fiber.child, results, depth + 1);
  findTextInputs(fiber.sibling, results, depth + 1);
  return results;
}

// Find root fiber
const root = Object.values(globalThis.__reactFiber || {});
alert("react fiber globals: " + Object.keys(globalThis).filter(k => k.includes("react") || k.includes("fiber") || k.includes("React")).join(", "));
