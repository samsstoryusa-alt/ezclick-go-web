'use client';
import {useEffect, useRef, useState, type FormEvent, type RefObject} from 'react';
import {useWeatherLanguage} from './weather-language';
import {sendSupportReport, supportDiagnostics, type SupportContext, type SupportReport} from './weather-support-data';
import './weather-support.css';

type Props = {open: boolean; onClose: () => void; returnFocus: RefObject<HTMLDivElement | null>; context: SupportContext};

export default function WeatherSupport({open, onClose, returnFocus, context}: Props) {
  const {t, dir} = useWeatherLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const [description, setDescription] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [aiConsent, setAiConsent] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState('');
  const inFlight = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<{signature: string; report: SupportReport} | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    if (open) {
      if (!element.open) element.showModal();
      frame = requestAnimationFrame(() => {element.dataset.visible = 'true';});
    } else if (element.open) {
      element.dataset.visible = 'false';
      timer = setTimeout(() => {
        element.close();
        returnFocus.current?.querySelector<HTMLButtonElement>('.weather-site-menu-toggle')?.focus();
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
    }
    return () => {cancelAnimationFrame(frame); clearTimeout(timer);};
  }, [open, returnFocus]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const diagnostics = typeof navigator === 'undefined' ? null : supportDiagnostics(context, {
    userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    width: window.innerWidth, height: window.innerHeight, online: navigator.onLine,
  }, import.meta.env.VITE_WEATHER_BUILD_ID || 'development');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const text = description.trim();
    if (Array.from(text).length < 10) {setError('Please describe the problem in at least 10 characters.'); descriptionInput.current?.focus(); return;}
    const signature = JSON.stringify([text, replyTo.trim(), includeDiagnostics, context.language, aiConsent]);
    // A retry reuses the original payload, even if network/viewport changes.
    // This prevents duplicate tickets after a lost response.
    const report: SupportReport = pending?.signature === signature ? pending.report : {
      requestId: crypto.randomUUID(), description: text, replyTo: replyTo.trim(), language: context.language,
      diagnostics: includeDiagnostics ? diagnostics : null,
      aiConsent,
    };
    setPending({signature, report});
    const controller = new AbortController();
    inFlight.current = controller;
    setSending(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const id = await sendSupportReport(report, controller.signal);
      setTicket(id); setDescription(''); setReplyTo(''); setAiConsent(false); setPending(null);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'rate_limited'
        ? 'Too many reports. Please try again in an hour or email us.'
        : 'Could not confirm receipt. Your text is still here. Please retry or email us.');
    } finally {
      clearTimeout(timeout); inFlight.current = null; setSending(false);
    }
  }

  return <dialog ref={dialog} className="weather-support" dir={dir} aria-labelledby="support-title" aria-describedby="support-intro"
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {if (event.target === event.currentTarget) {const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();}}}>
    <div className="weather-support-panel">
      <header><div><span className="support-eyebrow">EZ CLICK WEATHER</span><h2 id="support-title">{t('Report a problem')}</h2></div>
        <button type="button" className="support-close" aria-label={t('Close support')} onClick={onClose}>×</button></header>
      <p id="support-intro">{t('Tell us what happened and what you expected. Do not include passwords or sensitive information.')}</p>
      {ticket ? <div className="support-success" role="status">
        <span className="support-success-icon" aria-hidden="true">✓</span><h3>{t('Report received')}</h3><p>{t('Keep this number for your follow-up.')}</p><strong className="support-ticket">{ticket}</strong>
        <button type="button" className="support-primary" onClick={onClose}>{t('Back to map')}</button>
        <button type="button" className="support-link" onClick={() => {setTicket(''); setError('');}}>{t('Report another problem')}</button>
      </div> : <form onSubmit={submit}>
        <fieldset disabled={sending}>
          <label htmlFor="support-description">{t('What went wrong?')}</label>
          <textarea ref={descriptionInput} id="support-description" required minLength={10} maxLength={6000} rows={4} value={description} onChange={event => setDescription(event.target.value)} aria-describedby="support-error" />
          <label htmlFor="support-reply">{t('Email for a reply (optional)')}</label>
          <input id="support-reply" type="email" autoComplete="email" inputMode="email" maxLength={254} value={replyTo} onChange={event => setReplyTo(event.target.value)} />
          <label className="support-check"><input type="checkbox" checked={includeDiagnostics} onChange={event => setIncludeDiagnostics(event.target.checked)} /><span>{t('Include technical details')}</span></label>
          <p className="support-hint">{t('Browser, device, app version and settings. No locations, routes or voice recordings.')}</p>
          <button type="button" className="support-link support-details-toggle" aria-expanded={detailsOpen} aria-controls="support-details" onClick={() => setDetailsOpen(value => !value)}>{t('View technical details')}<span aria-hidden="true">{detailsOpen ? '−' : '+'}</span></button>
          <div className={`support-details ${detailsOpen ? 'is-open' : ''}`} inert={!detailsOpen} aria-hidden={!detailsOpen} id="support-details"><div><pre dir="ltr">{JSON.stringify(pending?.report.diagnostics && pending.signature === JSON.stringify([description.trim(), replyTo.trim(), includeDiagnostics, context.language, aiConsent]) ? pending.report.diagnostics : diagnostics, null, 2)}</pre></div></div>
          <label className="support-check"><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} aria-describedby="support-ai-hint" /><span>{t('Allow AI-assisted review (optional)')}</span></label>
          <p className="support-hint" id="support-ai-hint">{t('OpenAI receives your description, language and device system to help review the issue. Your reply email is excluded.')}</p>
          <p className="support-hint">{t('Your report goes to EZ Click Support. A server copy is kept for 30 days.')}</p>
        </fieldset>
        <p id="support-error" className="support-error" role="alert">{error ? t(error) : ''}</p>
        <button type="submit" className="support-primary" disabled={sending} aria-busy={sending}>{t(sending ? 'Sending report…' : 'Send report')}</button>
      </form>}
      <footer><span>{t('You can also email us:')}</span><a href="mailto:support@ezclickgo.com">support@ezclickgo.com</a></footer>
    </div>
  </dialog>;
}
