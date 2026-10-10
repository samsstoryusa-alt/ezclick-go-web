(() => {
 'use strict';
 const button = document.querySelector('.copy-email');
 if (!button) return;
 const address = 'support@ezclickgo.com';
 const status = document.querySelector('.copy-email-status');
 button.hidden = false;
 button.addEventListener('click', async () => {
  let copied = false;
  if (window.isSecureContext && navigator.clipboard) {
   try { await navigator.clipboard.writeText(address); copied = true; } catch {}
  }
  if (!copied) {
   const input = document.createElement('textarea');
   input.value = address; input.readOnly = true;
   input.style.cssText = 'position:fixed;left:-9999px;top:0';
   document.body.append(input); input.select();
   try { copied = document.execCommand('copy'); } catch {}
   input.remove(); button.focus({preventScroll:true});
  }
  status.textContent = copied ? 'Email address copied.' : 'Select and copy the email address above.';
 });
})();