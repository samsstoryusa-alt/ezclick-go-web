export const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
export function tripEstimate(rate:number){
 const maintenance=Math.round(rate*.12),dispatch=Math.round(rate*.1);
 const costs=[861,62,40,120,maintenance,dispatch];
 const expenses=costs.reduce((a,b)=>a+b,0);
 return {costs,expenses,net:rate-expenses,rpm:(rate-expenses)/1230};
}
export const markets=[
 {code:'NC',name:'North Carolina',loads:1248,trucks:388,rpm:2.94,note:'Strong outbound demand'},
 {code:'TX',name:'Texas',loads:2184,trucks:910,rpm:2.68,note:'More loads than trucks'},
 {code:'GA',name:'Georgia',loads:936,trucks:520,rpm:2.42,note:'Moderate outbound demand'},
 {code:'FL',name:'Florida',loads:462,trucks:660,rpm:1.92,note:'More trucks than loads'},
];
export const fuelOptions=[{name:'Nearby stop',price:3.48},{name:'Lower-price stop',price:3.11}];
export const fuelGallons=124;
