import {env} from 'cloudflare:workers';
export function getInquiryDb(){if(!env.DB)throw new Error('Inquiry storage unavailable');return env.DB;}
