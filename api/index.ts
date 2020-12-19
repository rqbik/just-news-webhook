import { NowRequest, NowResponse } from '@vercel/node';

interface GitlabJobEvent {
  build_name: 'build' | 'deploy';
  build_status: 'failed' | 'success';
  repository: {
    name: string;
  };
}

export default (request: NowRequest, response: NowResponse) => {
  if (request.headers['x-gitlab-token'] !== process.env.GITLAB_TOKEN)
    response.status(401).json({ error: 'Unathorized' });

  const invalidWebhook = () =>
    response.status(401).json({ error: 'Invalid webhook' });

  if (request.headers['x-gitlab-event'] !== 'Job Hook') return invalidWebhook();

  const {
    repository,
    build_name,
    build_status,
  } = request.body as GitlabJobEvent;

  if (
    repository.name !== 'JustWebsite' ||
    build_name !== 'deploy' ||
    build_status === 'failed'
  )
    return invalidWebhook();

  console.log(request.body, request.headers, request.rawHeaders);
  response.status(200).json({ hello: 'world!' });
};
