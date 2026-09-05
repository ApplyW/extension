// The ApplyW website's address, in one place.
//
// Two things depend on it and must never disagree: manifest.config.ts uses it to decide
// which origins may ask this extension for the user's metrics counts, and the popup uses
// it to link there. If those two drift apart, the link opens a page the extension then
// refuses to talk to — which looks exactly like the feature being broken.
//
// Moving to a custom domain is an edit here. Keep BOTH the old and the new origin in the
// list through the switchover: a published extension only picks up a new manifest once
// store review clears, which takes days, and until then anyone landing on the new domain
// would be told to install what they already have. Drop the old one a release later.
export const SITE_ORIGINS = ['https://applyw.chudnovskyi-v.workers.dev']

// The canonical one to send people to — first in the list is always the current home.
export const SITE_URL = SITE_ORIGINS[0]

export const METRICS_URL = `${SITE_URL}/#metrics`
