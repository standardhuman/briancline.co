export function requireResendSuccess(result) {
  if (result?.error?.name) {
    throw new Error(`Resend send failed: ${result.error.name}`);
  }

  if (!result?.data?.id) {
    throw new Error('Resend send failed: missing message id');
  }

  return result.data.id;
}
