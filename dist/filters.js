let shopFilters={collection:'All',colours:[],budget:false};
let sheetDraft=null;
function matchingProducts(filters){
 return products.filter(p=>(filters.collection==='All'||p.collection===filters.collection)&&(!filters.colours.length||filters.colours.includes(p.colour))&&(!filters.budget||p.price<5000));
}
function filterFields(filters,prefix){
 const colours={Emerald:'#2e6252',Rose:'#bb7c8f',Indigo:'#323d69',Ivory:'#ded2ad'};
 return `<fieldset><legend>Collection</legend><div class="filter-options">${['All','Silk','Cotton','Festive'].map(c=>`<label for="${prefix}-${c}"><input id="${prefix}-${c}" type="radio" name="${prefix}-collection" value="${c}" ${filters.collection===c?'checked':''}><span>${c==='All'?'All sarees':c+' sarees'}</span></label>`).join('')}</div></fieldset><fieldset><legend>Colour</legend><div class="filter-options">${Object.entries(colours).map(([c,hex])=>`<label for="${prefix}-${c}"><input id="${prefix}-${c}" type="checkbox" name="${prefix}-colour" value="${c}" ${filters.colours.includes(c)?'checked':''}><span class="filter-colour" style="background:${hex}" aria-hidden="true"></span><span>${c}</span></label>`).join('')}</div></fieldset><fieldset><legend>Price range</legend><label for="${prefix}-budget"><input id="${prefix}-budget" type="checkbox" name="${prefix}-budget" ${filters.budget?'checked':''}><span>Under ₹5,000</span></label></fieldset>`;
}
function readFilterFields(root,prefix){
 return {collection:root.querySelector(`[name="${prefix}-collection"]:checked`)?.value||'All',colours:[...root.querySelectorAll(`[name="${prefix}-colour"]:checked`)].map(x=>x.value),budget:root.querySelector(`[name="${prefix}-budget"]`).checked};
}
function openFilterSheet(){
 const sheet=document.querySelector('#filterSheet');
 if(!sheet||sheet.open)return;
 sheetDraft={...shopFilters,colours:[...shopFilters.colours]};
 document.querySelector('#sheetFields').innerHTML=filterFields(sheetDraft,'sheet');
 updateSheetCount();
 sheet.classList.remove('is-closing');
 sheet.showModal();
}
function updateSheetCount(){const count=matchingProducts(sheetDraft).length;document.querySelector('#sheetResultCount').textContent='Show '+count+(count===1?' saree':' sarees');}
function closeFilterSheet(){
 const sheet=document.querySelector('#filterSheet');
 if(!sheet?.open||sheet.classList.contains('is-closing'))return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){sheet.close();return;}
 sheet.classList.add('is-closing');
 setTimeout(()=>{sheet.close();sheet.classList.remove('is-closing');},180);
}
function applySheetFilters(){
 shopFilters={...sheetDraft,colours:[...sheetDraft.colours]};
 document.querySelector('#desktopFilters').innerHTML=filterFields(shopFilters,'desktop')+'<button class="text-link filter-reset" type="button" onclick="resetFilters()">Clear filters</button>';
 filterShop();closeFilterSheet();
}
function resetSheetFilters(){
 sheetDraft={collection:'All',colours:[],budget:false};
 document.querySelector('#sheetFields').innerHTML=filterFields(sheetDraft,'sheet');
 updateSheetCount();
}
function initFilterSheet(){
 const sheet=document.querySelector('#filterSheet');
 document.querySelector('#desktopFilters').addEventListener('change',event=>{if(event.target.matches('input')){shopFilters=readFilterFields(event.currentTarget,'desktop');filterShop();}});
 document.querySelector('#sheetFields').addEventListener('change',event=>{if(event.target.matches('input')){sheetDraft=readFilterFields(event.currentTarget,'sheet');updateSheetCount();}});
 sheet.addEventListener('cancel',event=>{event.preventDefault();closeFilterSheet();});
 sheet.addEventListener('close',()=>{sheetDraft=null;});
 let beganOutside=false;
 const outside=event=>{const r=sheet.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 sheet.addEventListener('pointerdown',event=>{beganOutside=outside(event);});
 sheet.addEventListener('click',event=>{if(beganOutside&&outside(event))closeFilterSheet();beganOutside=false;});
}
matchMedia('(min-width: 701px)').addEventListener('change',event=>{if(event.matches)document.querySelector('#filterSheet')?.close();});
