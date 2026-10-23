"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="container section"><div className="panel" role="alert"><h1>Tournament unavailable</h1><p>The saved tournament could not be loaded. Please try again.</p><button className="primary-btn" onClick={reset}>Try again</button></div></main>;
}
