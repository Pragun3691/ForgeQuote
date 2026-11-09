import React from 'react';
import {dateLabel,timestamp} from './format.js';

export default function SavedVersionNav({versions,versionId,rfqId,snapshot,canWrite,loading,error}) {
  return <section className="saved-version-context" aria-label="Saved version selection">
    <div className="version-context"><p className="eyebrow">Immutable quotation history</p><p>{snapshot?<><strong>Selected: Version {snapshot.versionNumber}</strong><span>Pricing date {dateLabel(snapshot.pricingDate)} · Saved {timestamp(snapshot.createdAt)}</span></>:<><strong>{error?'Selected saved quotation unavailable':versionId?'Selected saved quotation':'No saved quotation selected'}</strong><span>{error?'Use Reload saved quotation to retry this read.':loading?'Loading its saved inputs and financial results...':versionId?'Saved results are not currently displayed.':versions.length?'Choose a version to review its saved inputs and financial results.':canWrite?'Calculate and save a draft to create the first quotation version.':'An estimator can calculate and save the first quotation version.'}</span></>}</p></div>
    {!!versions.length&&<nav className="version-nav" aria-label="Saved versions"><strong>Saved versions</strong>{versions.map(version=><a key={version.id} aria-current={versionId?.toLowerCase()===version.id.toLowerCase()?'page':undefined} href={`#${new URLSearchParams({rfq:rfqId,version:version.id})}`}>Version {version.versionNumber} · {dateLabel(version.pricingDate)}</a>)}</nav>}
  </section>;
}
