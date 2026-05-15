#import "ObjCExceptionCatcher.h"

@implementation ObjCExceptionCatcher

+ (NSError *)catchException:(__attribute__((noescape)) void (^)(void))block {
    @try {
        block();
        return nil;
    } @catch (NSException *exception) {
        NSMutableDictionary<NSErrorUserInfoKey, id> *userInfo = [NSMutableDictionary dictionary];
        userInfo[NSLocalizedDescriptionKey] = exception.reason ?: exception.name ?: @"<unknown NSException>";
        userInfo[@"name"] = exception.name ?: @"<unknown>";
        if (exception.reason) {
            userInfo[@"reason"] = exception.reason;
        }
        if (exception.callStackSymbols) {
            userInfo[@"callStackSymbols"] = exception.callStackSymbols;
        }
        return [NSError errorWithDomain:@"ObjCExceptionCatcher" code:0 userInfo:userInfo];
    }
}

@end
