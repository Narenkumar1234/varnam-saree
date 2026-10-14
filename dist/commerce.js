const varnamConfig=window.VARNAM_CONFIG||{};

function configuredWhatsAppNumber(){
  return String(varnamConfig.whatsappNumber||'').replace(/\D/g,'');
}

function openWhatsAppOrder(lines){
  const number=configuredWhatsAppNumber();
  if(!number){
    toast('WhatsApp ordering is ready for the Varnam business number.');
    return;
  }
  const message=['Hello Varnam, I would like to order:',...lines,'','Please confirm availability and delivery details.'].join('\n');
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
}

function orderProductOnWhatsApp(id){
  const product=pBy(id);
  const finish=document.querySelector('#finish')?.value||'Unstitched blouse · included';
  openWhatsAppOrder([`${product.name} × ${productQty}`,finish,`Price: ${money(product.price*productQty)}`,`Product: ${location.origin}${location.pathname}#/product/${product.id}`]);
}

function orderCartOnWhatsApp(){
  if(!cart.length)return;
  const lines=cart.map(item=>`${pBy(item.id).name} × ${item.qty} — ${money(pBy(item.id).price*item.qty)}`);
  lines.push(`Order total shown: ${money(subtotal()-(discount?Math.round(subtotal()*.1):0)+(subtotal()>=3000?0:150))}`);
  openWhatsAppOrder(lines);
}

function decodeGoogleProfile(credential){
  const payload=credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(decodeURIComponent(atob(payload).split('').map(char=>'%'+char.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
}

function handleGoogleCredential(response){
  try{
    const googleProfile=decodeGoogleProfile(response.credential);
    profile={name:googleProfile.name||googleProfile.given_name||'Varnam customer',email:googleProfile.email||''};
    save();
    location.hash='/account';
  }catch(error){
    toast('Google sign-in could not be completed. Please try again.');
  }
}

function initGoogleSignIn(){
  const authTabs=document.querySelector('.auth .tabs');
  if(!authTabs)return;
  const target=document.createElement('div');
  target.id='googleSignIn';
  target.className='google-signin';
  target.setAttribute('aria-live','polite');
  authTabs.insertAdjacentElement('afterend',target);
  target.insertAdjacentHTML('afterend','<div class="auth-divider"><span>or continue with email</span></div>');
  const clientId=String(varnamConfig.googleClientId||'').trim();
  if(!clientId){
    target.innerHTML='<button class="google-setup" type="button" aria-disabled="true"><span class="google-mark">G</span><span>Continue with Google</span></button><small>Google connection details are being configured.</small>';
    target.querySelector('button').addEventListener('click',()=>toast('Google sign-in is ready for the store OAuth client ID.'));
    return;
  }
  const renderButton=()=>{
    if(!window.google?.accounts?.id)return;
    target.replaceChildren();
    google.accounts.id.initialize({client_id:clientId,callback:handleGoogleCredential});
    google.accounts.id.renderButton(target,{type:'standard',theme:'outline',size:'large',shape:'rectangular',text:'continue_with',width:360});
  };
  if(window.google?.accounts?.id){renderButton();return;}
  let script=document.querySelector('script[data-google-identity]');
  if(!script){
    script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';
    script.async=true;
    script.dataset.googleIdentity='true';
    document.head.append(script);
  }
  script.addEventListener('load',renderButton,{once:true});
  script.addEventListener('error',()=>{target.innerHTML='<p class="integration-status">Google sign-in is temporarily unavailable.</p>';},{once:true});
}

function initCommerce(route){
  if(route==='login'||route==='signup'||(route==='account'&&!profile))initGoogleSignIn();
  if(route==='cart'&&cart.length){
    const checkout=document.querySelector('.summary-box .btn[href="#/checkout"]');
    checkout?.insertAdjacentHTML('afterend',`<button class="whatsapp-order" type="button" onclick="orderCartOnWhatsApp()">${icon('whatsapp')} Order on WhatsApp</button>`);
  }
}

function refreshCommerce(){
  const route=(location.hash.slice(1)||'/').split('?')[0].split('/').filter(Boolean)[0]||'home';
  setTimeout(()=>initCommerce(route),0);
}

window.addEventListener('hashchange',refreshCommerce);
window.addEventListener('DOMContentLoaded',refreshCommerce);
