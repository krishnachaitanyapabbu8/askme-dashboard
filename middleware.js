export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

export default function middleware(request) {
  const basicAuth = request.headers.get('authorization');

  if (basicAuth) {
    const [user, pwd] = atob(basicAuth.split(' ')[1]).split(':');
    const validUser = process.env.BASIC_AUTH_USER;
    const validPass = process.env.BASIC_AUTH_PASS;

    if (user === validUser && pwd === validPass) {
      return;
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="AskMe Dashboard"',
    },
  });
}
