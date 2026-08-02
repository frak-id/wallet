package id.frak.sdk.core

/** Outcome of a fire-and-forget call. Not `kotlin.Result`: merchants need the typed [FrakError] arm. */
public sealed interface FrakResult<out T> {
    public class Success<out T>(
        public val value: T,
    ) : FrakResult<T>

    public class Failure(
        public val error: FrakError,
    ) : FrakResult<Nothing>
}
