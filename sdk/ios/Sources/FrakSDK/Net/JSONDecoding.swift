import Foundation

enum JSONDecoding {
    private static let decoder = JSONDecoder()

    /// Decodes `body` as `T`, mapping any decode failure to a precise `FrakError.decoding`.
    static func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch let DecodingError.keyNotFound(key, context) {
            throw FrakError.decoding(message: "missing required field \"\(key.stringValue)\" at \(path(context))")
        } catch let DecodingError.typeMismatch(_, context) {
            throw FrakError.decoding(message: "wrong type for field at \(path(context))")
        } catch let DecodingError.valueNotFound(_, context) {
            throw FrakError.decoding(message: "null value for required field at \(path(context))")
        } catch let DecodingError.dataCorrupted(context) {
            throw FrakError.decoding(message: "malformed JSON at \(path(context)): \(context.debugDescription)")
        } catch {
            throw FrakError.decoding(message: "unexpected failure: \(error.localizedDescription)")
        }
    }

    /// Best-effort read of the `code` field of a `{ success: false, error, code }` envelope.
    /// Never throws — tolerates a non-JSON (e.g. text/plain) body.
    static func errorCode(in data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object["code"] as? String
    }

    private static func path(_ context: DecodingError.Context) -> String {
        context.codingPath.map(\.stringValue).joined(separator: ".")
    }
}

/// Key type for probing a value's shape without caring which keys it holds.
private struct AnyCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}

extension KeyedDecodingContainer {
    /// An optional scalar that degrades to nil on a wrong-typed value instead of failing the
    /// whole response, mirroring Kotlin `JsonReader.string`/`double`/`boolean`. A merchant
    /// binary is frozen at store submission, so a reshaped optional field must not brick every
    /// install of that build.
    ///
    /// Scalars only: on a nested object this would also swallow a required field missing
    /// inside it, which is a contract break that must stay loud. Use `decodeForgivingObject`.
    func decodeForgiving<T: Decodable>(_ type: T.Type, forKey key: Key) -> T? {
        (try? decodeIfPresent(type, forKey: key)) ?? nil
    }

    /// An optional nested object: nil when absent, JSON null, or not an object at all, but a
    /// value that *is* an object still decodes strictly. Mirrors Kotlin `JsonReader.obj`, which
    /// nils a wrong-shaped field yet lets `requireX` inside the mapper throw.
    func decodeForgivingObject<T: Decodable>(_ type: T.Type, forKey key: Key) throws -> T? {
        guard contains(key), (try? nestedContainer(keyedBy: AnyCodingKey.self, forKey: key)) != nil else {
            return nil
        }
        return try decode(type, forKey: key)
    }
}

/// An array of objects that skips entries which are not objects, and decodes the ones that are
/// strictly. Absent, JSON null and non-array all read as empty. Mirrors Kotlin
/// `JsonReader.objectArray`.
struct ForgivingArray<Element: Decodable>: Decodable {
    let elements: [Element]

    init(from decoder: any Decoder) throws {
        guard var container = try? decoder.unkeyedContainer() else {
            elements = []
            return
        }
        var decoded: [Element] = []
        while !container.isAtEnd {
            // `superDecoder` advances the cursor whatever the entry turns out to be, so a
            // skipped entry cannot spin the loop.
            let entry = try container.superDecoder()
            guard (try? entry.container(keyedBy: AnyCodingKey.self)) != nil else { continue }
            decoded.append(try Element(from: entry))
        }
        elements = decoded
    }
}
