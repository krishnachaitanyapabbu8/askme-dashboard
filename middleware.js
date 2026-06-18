export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};

// Base64 of "admin:Quad@123"
const VALID_AUTH = 'Basic YWRtaW46UXVhZEAxMjM=';

export default function middleware(request) {
  const auth = request.headers.get('authorization');

  if (auth === VALID_AUTH) {
    return;
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="AskMe Dashboard"',
    },
  });
}
