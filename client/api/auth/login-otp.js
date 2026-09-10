import verifyHandler from './verify-otp.js';

export default async function handler(req, res) {
  return verifyHandler(req, res);
}
