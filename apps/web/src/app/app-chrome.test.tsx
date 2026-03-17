import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppChrome } from './app-chrome';

type LinkStubProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

function LinkStub({ href, className, children }: LinkStubProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function UserButtonStub() {
  return <div data-testid="user-button">User</div>;
}

void test('renders only children when the user is signed out', () => {
  const html = renderToStaticMarkup(
    <AppChrome
      isAuthenticated={false}
      LinkComponent={LinkStub}
      UserButtonComponent={UserButtonStub}
    >
      <div>Login screen</div>
    </AppChrome>,
  );

  assert.match(html, /Login screen/);
  assert.doesNotMatch(html, /Reservations/);
  assert.doesNotMatch(html, /Contacts/);
  assert.doesNotMatch(html, /data-testid="user-button"/);
});

void test('renders the full app chrome when the user is signed in', () => {
  const html = renderToStaticMarkup(
    <AppChrome
      isAuthenticated
      LinkComponent={LinkStub}
      UserButtonComponent={UserButtonStub}
    >
      <div>Dashboard</div>
    </AppChrome>,
  );

  assert.match(html, /Dashboard/);
  assert.match(html, /Reservations/);
  assert.match(html, /Contacts/);
  assert.match(html, /data-testid="user-button"/);
});
