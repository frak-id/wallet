package id.frak.sdk.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [FrakLogger] is `internal`; this file has friend access through the same-module JVM test
 * source set (see [id.frak.sdk.PublicSurfaceTest]'s doc for that access model).
 *
 * Every case here exercises [FrakLogSink] only, never `android.util.Log` — [Log] is a stubbed
 * method on the JVM unit-test classpath and throws unless mocked, as [FrakLogger]'s own doc
 * says, and no mocking framework runs in this test tier.
 */
class FrakLoggerTest {
    private class RecordingSink : FrakLogSink {
        val calls = mutableListOf<Triple<FrakLogLevel, String, Throwable?>>()

        override fun log(
            level: FrakLogLevel,
            message: String,
            throwable: Throwable?,
        ) {
            calls.add(Triple(level, message, throwable))
        }
    }

    @Test
    fun `messages at or below logLevel reach the sink`() {
        val sink = RecordingSink()
        val logger = FrakLogger(FrakLogLevel.WARN, sink)

        logger.error("boom")
        logger.warn("careful")

        assertEquals(2, sink.calls.size)
        assertEquals(FrakLogLevel.ERROR, sink.calls[0].first)
        assertEquals("boom", sink.calls[0].second)
        assertEquals(FrakLogLevel.WARN, sink.calls[1].first)
        assertEquals("careful", sink.calls[1].second)
    }

    @Test
    fun `messages above logLevel do not reach the sink`() {
        val sink = RecordingSink()
        val logger = FrakLogger(FrakLogLevel.ERROR, sink)

        logger.warn("careful")
        logger.info("fyi")
        logger.debug("trace")

        assertTrue(sink.calls.isEmpty())
    }

    @Test
    fun `NONE delivers nothing to the sink`() {
        val sink = RecordingSink()
        val logger = FrakLogger(FrakLogLevel.NONE, sink)

        logger.error("boom")
        logger.warn("careful")
        logger.info("fyi")
        logger.debug("trace")

        assertTrue(sink.calls.isEmpty())
    }

    @Test
    fun `throwable is passed through to the sink`() {
        val sink = RecordingSink()
        val logger = FrakLogger(FrakLogLevel.DEBUG, sink)
        val cause = IllegalStateException("cause")

        logger.error("boom", cause)

        assertEquals(cause, sink.calls.single().third)
    }

    @Test
    fun `a throwing sink does not propagate out of the logger`() {
        val throwingSink =
            FrakLogSink { _, _, _ -> throw IllegalStateException("merchant sink is broken") }
        val logger = FrakLogger(FrakLogLevel.DEBUG, throwingSink)

        logger.error("boom")
        logger.warn("careful")
        logger.info("fyi")
        logger.debug("trace")
    }
}
