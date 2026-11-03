import { useEffect, useState } from 'react';

/** Valeur stabilisée après `delay` ms sans changement (recherche : une requête par pause de frappe). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
