export class ContentPublicationProtocol {
  async execute({ upload, verify, markReady, activate }) {
    await upload();
    const verification = await verify();
    await markReady(verification);
    await activate(verification);
    return verification;
  }
}
