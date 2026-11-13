// These component tests use string-recording DOM doubles. The real renderer is
// exercised separately in trusted-types.html under an enforced browser CSP.
export function renderFunction(...args) {
  const source=args.pop();
  return new Function(...args, 'const markup=element=>({set html(value){element.innerHTML=value;}});\n'+source);
}
