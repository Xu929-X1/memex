import { checkExpiration } from "@/utils/api/auth/token";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { BEARER_HEADER, CLIENT_HEADER, CLIENTS, parseClient } from "@memex/shared";
import { NextRequest } from "next/server";

export const POST = withApiHandler(async (request: NextRequest) => {
        const client = parseClient(request.headers.get(CLIENT_HEADER));
        if (client !== CLIENTS.desktop) throw AppError.forbidden("Desktop client only");
        
        const token = request.headers.get(BEARER_HEADER);
        if(!token){
            throw AppError.forbidden("Invalid Credentials");
        }
        const isValid  = await checkExpiration(token);
        if(isValid){
            return {
                valid: true
            }
        }else{
            throw AppError.forbidden("Invalid Credentials");
        }
});