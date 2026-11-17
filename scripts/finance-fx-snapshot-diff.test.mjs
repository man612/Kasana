import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { compareSyntheticFxSnapshots as diff } from './finance-fx-snapshot-diff.mjs';

const before={
  schemaVersion:1, fixtureId:'synthetic-fx-idr-aed', revision:'legacy',
  rows:[
    {key:'account:idr-wallet',kind:'account',nativeCents:'80000000',refCents:'17600'},
    {key:'transaction:historic-expense',kind:'transaction',nativeCents:'20000000',refCents:'4400'},
    {key:'balance:idr-wallet:2020-03-15',kind:'balance',nativeCents:'80000000',refCents:'17600'},
    {key:'loan:principal',kind:'loan',nativeCents:'-100000000',refCents:'-22000'},
    {key:'investment:cash',kind:'investment',nativeCents:'50000000',refCents:'11000'},
  ],
};
const after={
  ...before,revision:'corrected',
  rows:before.rows.map(row=>({
    ...row,refCents:({
      'account:idr-wallet':'18000','balance:idr-wallet:2020-03-15':'18000',
      'loan:principal':'-22500','investment:cash':'11250',
    })[row.key]??row.refCents,
  })),
};
const expected={
  fixtureId:before.fixtureId,refChanges:[
    {key:'account:idr-wallet',beforeRefCents:'17600',afterRefCents:'18000',reason:'Account IDR native holding repriced with synthetic corrected FX'},
    {key:'balance:idr-wallet:2020-03-15',beforeRefCents:'17600',afterRefCents:'18000',reason:'Derived historical balance recalculated with synthetic FX'},
    {key:'loan:principal',beforeRefCents:'-22000',afterRefCents:'-22500',reason:'Synthetic loan report valuation, principal unchanged'},
    {key:'investment:cash',beforeRefCents:'11000',afterRefCents:'11250',reason:'Synthetic investment cash valuation, native cash unchanged'},
  ],
};
const cp=structuredClone;
describe('Synthetic FX old/new cent-diff guard',()=>{
  it('explains four changes, preserving transaction historical reference cents',()=>{
    const result=diff(before,after,expected);
    assert.equal(result.totalRows,5);
    assert.equal(result.unchangedRows,1);
    assert.deepEqual(result.explainedChanges.map(x=>x.deltaRefCents),['400','400','250','-500']);
  });
  it('rejects unexplained valuation changes',()=>{
    const x=cp(expected);x.refChanges.pop();
    assert.throws(()=>diff(before,after,x),/unexplained reference-cent change/);
  });
  it('rejects changes to native holdings',()=>{
    const x=cp(after);x.rows[0].nativeCents='79999999';
    assert.throws(()=>diff(before,x,expected),/native ledger cents changed/);
  });
  it('rejects silent historic refAmount rewrites',()=>{
    const x=cp(after);x.rows.find(r=>r.kind==='transaction').refCents='4500';
    assert.throws(()=>diff(before,x,expected),/unexplained reference-cent change/);
  });
  it('rejects missing or duplicated rows',()=>{
    const a=cp(after);a.rows.pop();
    assert.throws(()=>diff(before,a,expected),/ledger row count changed/);
    const b=cp(after);b.rows.push(cp(b.rows[0]));
    assert.throws(()=>diff(before,b,expected),/duplicate row/);
  });
  it('rejects no-op approvals and unsupported fixture data',()=>{
    const a=cp(expected);a.refChanges[0].afterRefCents=a.refChanges[0].beforeRefCents;
    assert.throws(()=>diff(before,after,a),/no-op/);
    const b=cp(before);b.fixtureId='private-ledger';
    assert.throws(()=>diff(b,after,expected),/synthetic fixture required/);
    const c=cp(after);c.rows[0].refCents='0.23';
    assert.throws(()=>diff(before,c,expected),/integer cents string/);
  });
  it('preserves exact differences beyond Number.MAX_SAFE_INTEGER',()=>{
    const b={schemaVersion:1,fixtureId:'synthetic-big-cents',revision:'old',rows:[{key:'account:large',kind:'account',nativeCents:'9007199254740995',refCents:'9007199254740995'}]};
    const a={...b,revision:'new',rows:[{...b.rows[0],refCents:'9007199254741001'}]};
    const e={fixtureId:b.fixtureId,refChanges:[{key:'account:large',beforeRefCents:b.rows[0].refCents,afterRefCents:a.rows[0].refCents,reason:'Exact integer cents beyond double float precision'}]};
    assert.equal(diff(b,a,e).explainedChanges[0].deltaRefCents,'6');
  });
});
