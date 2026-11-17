import test from 'node:test';
import assert from 'node:assert/strict';
import {markup} from '../src/markup.mjs';

class FakeText {
  constructor(text) { this.textContent = text; this.childNodes = []; }
}
class FakeElement {
  constructor(tag, namespaceURI) {
    this.localName = tag;
    this.namespaceURI = namespaceURI;
    this.childNodes = [];
    this.attributes = {};
    this.style = { values: {}, setProperty(name, value) { this.values[name] = value; } };
  }
  append(...nodes) { this.childNodes.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}
const fakeDocument = {
  createDocumentFragment() { return new FakeElement('#fragment'); },
  createTextNode(text) { return new FakeText(text); },
  createElement(tag) { return new FakeElement(tag); },
  createElementNS(namespaceURI, tag) { return new FakeElement(tag, namespaceURI); },
};
function render(source) {
  const element = { ownerDocument: fakeDocument, replaceChildren(node) { this.root = node; } };
  markup(element).html = source;
  return element.root;
}

test('trusted avatar images render while external image sources stay blocked', () => {
  const root = render('<img src="assets/avatars/neo.jpg" alt="" draggable="false">');
  const image = root.childNodes[0];
  assert.equal(image.localName, 'img');
  assert.deepEqual(image.attributes, { src: 'assets/avatars/neo.jpg', alt: '', draggable: 'false' });

  const blob = render('<img src="blob:https://life.test/avatar">').childNodes[0];
  assert.equal(blob.attributes.src, 'blob:https://life.test/avatar');

  for (const source of [
    '<img src="https://evil.test/avatar.png">',
    '<img src="assets/avatars/../secret.jpg">',
    '<img src="assets/avatars/neo.jpg" srcset="https://evil.test/avatar.png">',
    '<span src="assets/avatars/neo.jpg"></span>',
  ]) assert.throws(() => render(source), /Unsupported template attribute/);
});

test('existing fixed HTML and SVG vocabulary keeps working', () => {
  const root = render('<svg viewBox="0 0 1 1"><path d="M0 0h1"/></svg><span>&lt;img&gt; &amp; &#39;</span>');
  assert.equal(root.childNodes[0].namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(root.childNodes[1].childNodes[0].textContent, "<img> & '");
});
