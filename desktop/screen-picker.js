'use strict'
const target = document.getElementById('sources')
const cancel = document.getElementById('cancel')
cancel.addEventListener('click', () => window.haxbagScreenPicker.cancel())
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.haxbagScreenPicker.cancel() })
window.haxbagScreenPicker.onSources(sources => {
  target.replaceChildren()
  if (!Array.isArray(sources) || !sources.length) {
    const p = document.createElement('p');p.textContent = 'Nenhuma tela ou janela disponível.';target.append(p);return
  }
  for (const source of sources) {
    const button = document.createElement('button')
    button.type='button';button.className='source'
    const preview = document.createElement('div');preview.className='preview'
    if (source.thumbnail && String(source.thumbnail).startsWith('data:image/png;base64,')) {
      const image = document.createElement('img');image.src=source.thumbnail;image.alt='Prévia da tela selecionável';preview.append(image)
    }
    const name = document.createElement('span');name.className='source-title';name.textContent=source.name
    const kind = document.createElement('span');kind.className='source-kind';kind.textContent=source.kind
    button.append(preview,name,kind)
    button.setAttribute('aria-label',`Compartilhar ${source.kind}: ${source.name}`)
    button.addEventListener('click',() => window.haxbagScreenPicker.choose(source.index))
    target.append(button)
  }
})
