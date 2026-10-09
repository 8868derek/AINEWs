import Foundation

@Observable
final class NewsStore {
    var items: [NewsItem] = []
    var topics: [HotTopic] = []
    var lastChecked: Date?
    var errorMessage: String?
    var isLoading = false

    private var itemsEtag: String?
    private var topicsEtag: String?
    private var itemsSignature = ""
    private var topicsSignature = ""
    private let cacheURL: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        cacheURL = base.appendingPathComponent("ainews-cache.json")
        loadCache()
    }

    func refresh() async {
        if items.isEmpty { isLoading = true }
        defer {
            isLoading = false
            lastChecked = Date()
        }
        do {
            try await refreshItems()
            try await refreshTopics()
            errorMessage = nil
        } catch {
            if items.isEmpty {
                errorMessage = "这次没有取到精选，稍后再试。"
            }
        }
    }

    private func refreshItems() async throws {
        switch try await NewsClient.fetchItems(etag: itemsEtag) {
        case .notModified:
            return
        case .updated(let fresh, let etag):
            itemsEtag = etag
            let signature = fresh.map(\.signature).joined(separator: "\n")
            guard signature != itemsSignature else {
                saveCache()
                return
            }
            itemsSignature = signature
            items = fresh
            saveCache()
        }
    }

    private func refreshTopics() async throws {
        switch try await NewsClient.fetchTopics(etag: topicsEtag) {
        case .notModified:
            return
        case .updated(let fresh, let etag):
            topicsEtag = etag
            let signature = fresh.map(\.signature).joined(separator: "\n")
            guard signature != topicsSignature else {
                saveCache()
                return
            }
            topicsSignature = signature
            topics = fresh
            saveCache()
        }
    }

    private func loadCache() {
        guard let data = try? Data(contentsOf: cacheURL),
              let cache = try? JSONDecoder().decode(Cache.self, from: data) else { return }
        items = cache.items
        topics = cache.topics
        itemsEtag = cache.itemsEtag
        topicsEtag = cache.topicsEtag
        itemsSignature = items.map(\.signature).joined(separator: "\n")
        topicsSignature = topics.map(\.signature).joined(separator: "\n")
    }

    private func saveCache() {
        let cache = Cache(items: items, topics: topics, itemsEtag: itemsEtag, topicsEtag: topicsEtag)
        guard let data = try? JSONEncoder().encode(cache) else { return }
        try? FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: cacheURL, options: .atomic)
    }
}

private struct Cache: Codable {
    let items: [NewsItem]
    let topics: [HotTopic]
    let itemsEtag: String?
    let topicsEtag: String?
}
