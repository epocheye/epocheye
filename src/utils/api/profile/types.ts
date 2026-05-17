export interface ProfileDigest {
  headline: string;
  body: string;
  dynasty_tags: string[];
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};
