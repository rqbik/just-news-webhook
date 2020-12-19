import { NowRequest, NowResponse } from '@vercel/node';

export default (request: NowRequest, response: NowResponse) => {
  console.log(request.body, request.headers, request.rawHeaders);
  response.status(200).json({ hello: 'world!' });
};
