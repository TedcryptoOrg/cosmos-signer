export type Account = {
    address: string,
    account_number: number,
    sequence: number,
    pub_key?: {
        '@type'?: string,
    },
}
