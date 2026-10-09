import Foundation

enum NewsClient {
    private static let itemsURL = URL(string: "https://aihot.news/api/v1/items?mode=selected&window=24h&limit=40")!
    private static let topicsURL = URL(string: "https://aihot.news/api/v1/hot-topics")!

    static func fetchItems(etag: String?) async throws -> FetchResult<[NewsItem]> {
        let data = try await send(itemsURL, etag: etag)
        if data.notModified { return .notModified }
        let items = try JSONDecoder().decode(ItemsEnvelope.self, from: data.body).items
        return .updated(items, etag: data.etag)
    }

    static func fetchTopics(etag: String?) async throws -> FetchResult<[HotTopic]> {
        let data = try await send(topicsURL, etag: etag)
        if data.notModified { return .notModified }
        let items = try JSONDecoder().decode(TopicsEnvelope.self, from: data.body).items
        return .updated(items, etag: data.etag)
    }

    private static func send(_ url: URL, etag: String?) async throws -> (notModified: Bool, body: Data, etag: String?) {
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("aihot-api/1.0 aihot-actor/\(actorID)", forHTTPHeaderField: "User-Agent")
        if let etag, !etag.isEmpty {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }
        let (body, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        let next = http.value(forHTTPHeaderField: "Etag") ?? http.value(forHTTPHeaderField: "ETag")
        if http.statusCode == 304 {
            return (true, Data(), next ?? etag)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return (false, body, next)
    }

    private static var actorID: String {
        let key = "aihot.actor"
        if let saved = UserDefaults.standard.string(forKey: key) {
            return saved
        }
        let created = UUID().uuidString.lowercased()
        UserDefaults.standard.set(created, forKey: key)
        return created
    }
}

enum FetchResult<T> {
    case notModified
    case updated(T, etag: String?)
}
