import { describe, expect, it } from 'vitest';
import { serializeAgentExhibit } from './requestContext';
describe('original artwork image context', () => {
  it('retains the image for repeated serialization while keeping it out of curatorial text', () => {
    const first=serializeAgentExhibit({id:'art',type:'painting',content:'/api/media/art?accessToken=private'});
    expect(first.content).toBeNull();
    expect(first.imageUrl).toBe('/api/media/art?accessToken=private');
    expect(serializeAgentExhibit(first).imageUrl).toBe(first.imageUrl);
  });
  it('does not interpret sculpture GLBs or colour literals as images', () => {
    expect(serializeAgentExhibit({id:'model',type:'sculpture',content:'/model.glb'}).imageUrl).toBeUndefined();
    expect(serializeAgentExhibit({id:'colour',type:'painting',content:'#ffffff'}).imageUrl).toBeUndefined();
  });
});
