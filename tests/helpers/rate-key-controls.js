// Single-part selectors stay in the part group; multi-part selectors live in
// the corresponding semantic matrix row. There is only one set of controls.
export function rateControls(page,number) {
  return page.getByRole('row',{name:`Rate keys for part ${number}`,exact:true})
    .or(page.getByRole('group',{name:`Part ${number}`,exact:true}));
}
