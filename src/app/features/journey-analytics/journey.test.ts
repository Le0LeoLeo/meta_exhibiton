import { afterEach, expect, it, vi } from 'vitest';
afterEach(()=>{ vi.unstubAllGlobals(); localStorage.clear();sessionStorage.clear(); vi.resetModules(); });
it('sends nothing before consent and omits identity, cookies and referrer after consent',async()=>{
 const fetcher=vi.fn<(url: string, options: RequestInit) => Promise<{ok: boolean}>>(async()=>({ok:true}));vi.stubGlobal('fetch',fetcher);
 const {recordJourney,setJourneyConsent}=await import('./journey');recordJourney('home');expect(fetcher).not.toHaveBeenCalled();
 await setJourneyConsent(true);recordJourney('home');recordJourney('home');recordJourney('gallery_enter');await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 const options=fetcher.mock.calls[0][1] as RequestInit;expect(options.credentials).toBe('omit');expect(options.referrerPolicy).toBe('no-referrer');expect(Object.keys(JSON.parse(options.body as string)).sort()).toEqual(['consent','sessionId','step']);
 await setJourneyConsent(false);expect(fetcher.mock.calls.at(-1)?.[0]).toBe('/api/journey/withdraw');recordJourney('ai_use');expect(fetcher).toHaveBeenCalledTimes(3);
});
it('honours browser opt-out even after an explicit allow',async()=>{
 vi.stubGlobal('navigator',{doNotTrack:'1'});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const {recordJourney,setJourneyConsent,consentState}=await import('./journey');await setJourneyConsent(true);recordJourney('home');expect(consentState()).toBe('blocked');expect(fetcher).not.toHaveBeenCalled();
});
it('retains a failed withdrawal for retry while stopping new events',async()=>{
 const fetcher=vi.fn<(url: string, options: RequestInit) => Promise<{ok: boolean}>>(async()=>({ok:true}));vi.stubGlobal('fetch',fetcher);const m=await import('./journey');await m.setJourneyConsent(true);m.recordJourney('home');await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());fetcher.mockResolvedValueOnce({ok:false});
 await expect(m.setJourneyConsent(false)).rejects.toThrow();expect(m.consentState()).toBe('declined');expect(sessionStorage.getItem('metaexb:journey-withdraw:v1')).not.toBeNull();await m.setJourneyConsent(false);expect(sessionStorage.getItem('metaexb:journey-withdraw:v1')).toBeNull();
});
