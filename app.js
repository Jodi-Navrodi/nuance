const hero = document.querySelector('.hero');
const focusArea = document.querySelector('.focus-area');
const menu = document.querySelector('#mobile-menu');
const menuToggle = document.querySelector('.menu-toggle');
const menuClose = document.querySelector('.menu-close');
const mobileQuery = matchMedia('(max-width: 999px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let geometry, current, target, frame = 0, previousTime = 0, touchStart;
let mobileFocusMoved = false;

// Only the container follows Safari's visible viewport. UI is never scene-scaled.
function syncMobileViewport() {
  if (!mobileQuery.matches) {
    document.documentElement.style.removeProperty('--mobile-stage-height');
    return;
  }
  const viewport = window.visualViewport;
  if (viewport && Math.abs(viewport.scale - 1) > .01) return;
  const height = viewport?.height ?? innerHeight;
  const style = getComputedStyle(document.documentElement);
  const inset = side => parseFloat(style.getPropertyValue(`--safe-area-${side}`)) || 0;
  const deficit = Math.max(0,844-height);
  const headerTop = Math.max(inset('top'),40-Math.min(20,deficit*.12));
  const copyTop = headerTop+44+Math.max(20,100-deficit*.39);
  const bottom = Math.max(inset('bottom'),24,60-deficit*.16);
  document.documentElement.style.setProperty('--mobile-stage-height',`${height}px`);
  document.documentElement.style.setProperty('--mobile-header-top',`${headerTop}px`);
  document.documentElement.style.setProperty('--mobile-copy-top',`${copyTop}px`);
  document.documentElement.style.setProperty('--mobile-copy-gap',`${Math.max(12,16-deficit*.018)}px`);
  document.documentElement.style.setProperty('--mobile-cta-bottom',`${bottom}px`);
}

function constrain(point) {
  return {
    x: Math.max(0, Math.min(geometry.width - geometry.focusWidth, point.x)),
    y: Math.max(0, Math.min(geometry.height - geometry.focusHeight, point.y))
  };
}

function paint() {
  hero.style.setProperty('--focus-x', `${current.x}px`);
  hero.style.setProperty('--focus-y', `${current.y}px`);
  hero.style.setProperty('--mask-y', `${current.y + (geometry.mobile ? 0 : geometry.scale)}px`);
}

function tick(time) {
  const dt = previousTime ? Math.min(time - previousTime, 48) : 16;
  previousTime = time;
  const easing = reduceMotion.matches ? 1 : 1 - Math.exp(-dt / 65);
  current.x += (target.x - current.x) * easing;
  current.y += (target.y - current.y) * easing;
  if (Math.abs(target.x-current.x) + Math.abs(target.y-current.y) < .08) {
    current = {...target}; frame = 0; previousTime = 0; paint(); return;
  }
  paint(); frame = requestAnimationFrame(tick);
}

function moveTo(point, immediate = false) {
  // Desktop follows the pointer even when part of the frame is off screen.
  // The hero clips the chrome and image; mobile retains its touch boundaries.
  target = geometry.mobile ? constrain(point) : {...point};
  if (immediate || reduceMotion.matches) {
    cancelAnimationFrame(frame); frame = 0; previousTime = 0;
    current = {...target}; paint();
  } else if (!frame) frame = requestAnimationFrame(tick);
}

function resetFocus(immediate = false) { moveTo(geometry.initial, immediate); }

function resizeMobile() {
  const previous = geometry;
  const previousTarget = target;
  const bounds = hero.getBoundingClientRect();
  const width = bounds.width, height = bounds.height;
  const copy = document.querySelector('.hero-copy').getBoundingClientRect();
  const lead = document.querySelector('.lead-mobile').getBoundingClientRect();
  const cta = document.querySelector('.consultation-button').getBoundingClientRect();
  const textBottom = lead.bottom-bounds.top, ctaTop=cta.top-bounds.top;
  const space = ctaTop-textBottom;
  const anchorX = width*265/390;
  const anchorY = textBottom+space*161/321;
  // Figma's approved 390×844 crop is x=128,y=29 in the new 660×1022 pair.
  // The initial frame centre is source point (393,605), fixed relative to face.
  // Cover constraints ensure that a portrait moved down cannot expose empty space.
  const scale = Math.max(space/321,width/660,height/1022,
    anchorX/393,(width-anchorX)/267,anchorY/605,(height-anchorY)/417);
  const offsetX=anchorX-393*scale, offsetY=anchorY-605*scale;
  const focusWidth=160*scale, focusHeight=220*scale;
  const initial={x:anchorX-focusWidth/2,y:anchorY-focusHeight/2};
  geometry={mobile:true,width,height,scale,focusWidth,focusHeight,initial,offsetX,offsetY};
  for(const [key,value] of Object.entries({
    '--plane-x':`${offsetX}px`,'--plane-y':`${offsetY}px`,
    '--plane-w':`${660*scale}px`,'--plane-h':`${1022*scale}px`,
    '--photo-scale':scale,'--focus-scale':scale,
    '--mask-w':`${159*scale}px`,'--mask-h':`${219*scale}px`,
    '--hero-height':`${height}px`,'--copy-top':`${copy.top-bounds.top}px`
  })) hero.style.setProperty(key,value);
  if(previous?.mobile && mobileFocusMoved){
    const sourceX=(previousTarget.x+previous.focusWidth/2-previous.offsetX)/previous.scale;
    const sourceY=(previousTarget.y+previous.focusHeight/2-previous.offsetY)/previous.scale;
    moveTo({x:offsetX+sourceX*scale-focusWidth/2,y:offsetY+sourceY*scale-focusHeight/2},true);
  } else resetFocus(true);
}

function resize() {
  if(mobileQuery.matches){resizeMobile();return;}
  const previousGeometry = geometry;
  const previousTarget = target;
  const mobile = mobileQuery.matches;
  const bounds = hero.getBoundingClientRect();
  const width = mobile ? hero.clientWidth : bounds.width;
  const height = mobile ? hero.clientHeight : bounds.height;
  const baseWidth = mobile ? 390 : 1440;
  const baseHeight = mobile ? 844 : 900;
  const scale = Math.max(width/baseWidth, height/baseHeight);
  const planeWidth = baseWidth*scale, planeHeight = baseHeight*scale;
  const offsetX = (width-planeWidth)/2;
  let offsetY = (height-planeHeight)/2, focusScale = scale;
  let portraitTop = 0, portraitBottom = height;
  // On tablets, keep the face and focus between the copy and CTA instead of
  // enlarging the phone's focus rectangle across the action button.
  if (mobile && width >= 500) {
    portraitTop = document.querySelector('.lead-mobile').getBoundingClientRect().bottom
      - hero.getBoundingClientRect().top + 24;
    const safeBottom = parseFloat(getComputedStyle(hero).getPropertyValue('--safe-area-bottom')) || 0;
    portraitBottom = height - 48 - Math.max(60, safeBottom) - 24;
    const eyePosition = (portraitTop + portraitBottom)/2;
    offsetY = Math.max(height-planeHeight, Math.min(0, eyePosition-530*scale));
    focusScale = Math.min(scale, 1.2, (portraitBottom-portraitTop)/220);
  }
  const focusWidth = (mobile ? 160 : 243)*focusScale;
  const focusHeight = (mobile ? 220 : 444)*focusScale;
  const initial = mobile && width >= 500
    ? {x:offsetX+265*scale-focusWidth/2,
       y:Math.max(portraitTop, Math.min(portraitBottom-focusHeight,
         offsetY+576*scale-focusHeight/2))}
    : {x:offsetX+(mobile ? 185 : 775)*scale,y:offsetY+(mobile ? 466 : 216)*scale};
  geometry = {mobile, width, height, scale, focusWidth, focusHeight, initial};
  const sceneScale = mobile ? bounds.width/width : 1;
  const copyTop = (document.querySelector('.hero-copy').getBoundingClientRect().top - bounds.top)/sceneScale;
  for (const [key,value] of Object.entries({
    '--plane-x':`${offsetX}px`, '--plane-y':`${offsetY}px`,
    '--plane-w':`${planeWidth}px`, '--plane-h':`${planeHeight}px`,
    '--photo-scale':scale, '--focus-scale':focusScale,
    '--mask-w':`${focusWidth-(mobile ? focusScale : 0)}px`,
    '--mask-h':`${focusHeight-focusScale}px`, '--hero-height':`${height}px`, '--copy-top':`${copyTop}px`
  })) hero.style.setProperty(key, value);
  if (mobile && previousGeometry?.mobile && mobileFocusMoved) {
    moveTo(previousTarget, true);
  } else resetFocus(true);
  if (!mobile && menu.open) closeMenu(false);
}

function moveFromPointer(event) {
  const rect = hero.getBoundingClientRect();
  // The approved desktop crosshair is offset half a source pixel to the right.
  // Account for that offset so its actual centre, rather than just the frame,
  // coincides with the cursor. Direct pointer updates avoid trailing behind it.
  const crosshairOffset = geometry.mobile ? 0 : .5 * geometry.scale;
  const sceneScale = geometry.mobile ? rect.width/geometry.width : 1;
  moveTo({x:(event.clientX-rect.left)/sceneScale-geometry.focusWidth/2-crosshairOffset,
    y:(event.clientY-rect.top)/sceneScale-geometry.focusHeight/2}, !geometry.mobile);
}

hero.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || geometry.mobile) return;
  moveFromPointer(event);
}, {capture:true});
hero.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse' && !geometry.mobile) resetFocus();
});

function inPortrait(event) {
  const copy = document.querySelector('.hero-copy').getBoundingClientRect();
  const lead = document.querySelector('.lead-mobile').getBoundingClientRect();
  const cta = document.querySelector('.consultation-button').getBoundingClientRect();
  const scale = geometry.mobile ? hero.getBoundingClientRect().width/geometry.width : 1;
  return event.clientY >= Math.max(copy.top,lead.bottom)+12*scale && event.clientY <= cta.top-16*scale;
}
focusArea.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && !geometry.mobile) return;
  if (touchStart || event.isPrimary === false) return;
  if (!inPortrait(event)) return;
  touchStart = {id:event.pointerId,x:event.clientX,y:event.clientY};
  if (geometry.mobile) {
    mobileFocusMoved = true;
    if (event.cancelable) event.preventDefault();
    focusArea.setPointerCapture(event.pointerId);
  }
  moveFromPointer(event);
});
focusArea.addEventListener('pointermove', event => {
  if (!touchStart || event.pointerId !== touchStart.id) return;
  if (geometry.mobile) {
    if (event.cancelable) event.preventDefault();
    moveFromPointer(event);
  } else {
    const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;
    if (Math.abs(dx)>Math.abs(dy)*1.1 || event.pointerType === 'pen') moveFromPointer(event);
  }
});
function finishPointer(event) {
  if (!touchStart || event.pointerId !== touchStart.id) return;
  touchStart = null;
  if (focusArea.hasPointerCapture(event.pointerId)) focusArea.releasePointerCapture(event.pointerId);
}
for (const name of ['pointerup','pointercancel','lostpointercapture'])
  focusArea.addEventListener(name,finishPointer);

// Older Safari without Pointer Events uses the same focus geometry and easing.
if (!window.PointerEvent) {
  focusArea.addEventListener('touchstart', event => {
    if (!geometry.mobile || touchStart || event.touches.length !== 1) return;
    const touch = event.changedTouches[0];
    if (!inPortrait(touch)) return;
    touchStart = {id:touch.identifier};
    mobileFocusMoved = true;
    if (event.cancelable) event.preventDefault();
    moveFromPointer(touch);
  }, {passive:false});
  focusArea.addEventListener('touchmove', event => {
    if (!geometry.mobile || !touchStart) return;
    const touch = [...event.changedTouches].find(item => item.identifier === touchStart.id);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    moveFromPointer(touch);
  }, {passive:false});
  for (const name of ['touchend','touchcancel']) focusArea.addEventListener(name,event => {
    if ([...event.changedTouches].some(item => item.identifier === touchStart?.id)) touchStart = null;
  });
}

// CSS locks the page; this non-passive guard also blocks older iOS rubber-band
// scrolling. Taps are never cancelled, so buttons and dialog controls still click.
// Only an overflowing menu may scroll, and its boundary cannot chain to the page.
let menuTouchY = 0;
document.addEventListener('touchstart',event => {
  if (geometry.mobile && event.touches.length === 1) menuTouchY = event.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchmove',event => {
  if (!geometry.mobile || event.touches.length !== 1) return;
  const y = event.touches[0].clientY;
  const delta = y-menuTouchY;
  menuTouchY = y;
  const insideMenu = menu.open && menu.contains(event.target);
  const menuCanScroll = insideMenu && menu.scrollHeight > menu.clientHeight + 1;
  const atBoundary = delta > 0 ? menu.scrollTop <= 0
    : menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 1;
  if ((!menuCanScroll || atBoundary) && event.cancelable) event.preventDefault();
}, {passive:false});
focusArea.addEventListener('keydown', event => {
  const step=event.shiftKey ? 40 : 16;
  const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if (event.key === 'Home' || event.key === 'Escape') {event.preventDefault();resetFocus();return;}
  const delta=moves[event.key]; if (!delta) return;
  event.preventDefault();moveTo({x:target.x+delta[0],y:target.y+delta[1]});
});

function openMenu() {
  menu.showModal();
  menuToggle.setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
  menuClose.focus({preventScroll:true});
}
function closeMenu(restoreFocus=true) {
  menu.close();
  menuToggle.setAttribute('aria-expanded','false');
  document.body.style.overflow='';
  if(restoreFocus) menuToggle.focus({preventScroll:true});
}
menuToggle.addEventListener('click',openMenu);
menuClose.addEventListener('click',()=>closeMenu());
menu.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});

document.querySelectorAll('[data-action]').forEach(button=>{
  button.addEventListener('click',()=>{
    document.dispatchEvent(new CustomEvent('nuance:action',{detail:{action:button.dataset.action}}));
    if(menu.open)closeMenu();
  });
  button.addEventListener('keydown',event=>{
    if(event.key === ' ' || event.key === 'Enter') button.classList.add('is-pressed');
  });
  for(const name of ['keyup','blur'])button.addEventListener(name,()=>button.classList.remove('is-pressed'));
});

new ResizeObserver(resize).observe(hero);
window.addEventListener('resize',syncMobileViewport);
window.visualViewport?.addEventListener('resize',syncMobileViewport);
mobileQuery.addEventListener('change',() => {
  touchStart = null;
  mobileFocusMoved = false;
  syncMobileViewport();
  resize();
});
syncMobileViewport();
resize();
document.fonts.ready.then(resize);

// Read-only diagnostics for the final check on a real smartphone.
window.nuanceViewport = () => {
  const viewport = window.visualViewport;
  const cta = document.querySelector('.consultation-button').getBoundingClientRect();
  const style = getComputedStyle(hero);
  const visibleTop = viewport?.offsetTop ?? 0;
  const visibleBottom = visibleTop + (viewport?.height ?? innerHeight);
  const safeBottom = parseFloat(style.getPropertyValue('--safe-area-bottom')) || 0;
  return {
    layoutViewport:{width:innerWidth,height:innerHeight},
    visualViewport:viewport ? {width:viewport.width,height:viewport.height,
      offsetTop:viewport.offsetTop,scale:viewport.scale} : null,
    heroHeight:hero.getBoundingClientRect().height,
    minHeroHeight:style.minHeight,
    safeArea:{top:style.getPropertyValue('--safe-area-top').trim(),
      right:style.getPropertyValue('--safe-area-right').trim(),
      bottom:style.getPropertyValue('--safe-area-bottom').trim(),
      left:style.getPropertyValue('--safe-area-left').trim()},
    cta:{top:cta.top,bottom:cta.bottom,height:cta.height},
    ctaFullyVisible:cta.top >= visibleTop && cta.bottom <= visibleBottom-safeBottom,
    smallViewportUnits:CSS.supports('height','100svh'),
    dynamicViewportUnits:CSS.supports('height','100dvh')
  };
};
