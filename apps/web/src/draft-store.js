// Transient working inputs only. Durable submitted intent stays in the existing
// feature-specific sessionStorage protocol. A store belongs to one auth lifetime.
export function createDraftStore() {
  const values=new Map(),dirty=new Set();
  return {
    read(key,initial) {if(!values.has(key))values.set(key,typeof initial==='function'?initial():initial);return values.get(key);},
    write(key,value) {values.set(key,value);},
    mark(key,value) {if(value)dirty.add(key);else dirty.delete(key);},
    hasUnsaved() {return dirty.size>0;}
  };
}
