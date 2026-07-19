// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title WatchHubRating
/// @notice One-wallet-one-vote community rating system + personal collection + watched tracking.
///         Each wallet can only ever cast ONE active rating per title — updating your score
///         replaces the old one rather than adding a second vote. This makes the average
///         tamper-resistant against bot-farming from a single address.
///
///         Movies use their TMDB movie id directly.
///         TV series use their TMDB tv id offset by 1_000_000_000 (done in the frontend)
///         so the two numbering spaces cannot collide.
contract WatchHubRating {

    // ─────────────────────────────────────────────────────────
    // Storage: Ratings
    // ─────────────────────────────────────────────────────────

    struct MovieStats {
        uint256 totalScore;  // sum of all CURRENT ratings (updated in-place, not accumulated)
        uint256 ratingCount; // number of distinct wallets that have an active rating
    }

    mapping(uint256 => MovieStats) private stats;
    mapping(uint256 => mapping(address => uint8)) private userScore; // 0 = unrated
    uint256[] private ratedMovieIds;
    mapping(uint256 => bool) private isTracked;

    // ─────────────────────────────────────────────────────────
    // Storage: Collection
    // ─────────────────────────────────────────────────────────

    mapping(address => uint256[]) private userCollectionIds;
    mapping(address => mapping(uint256 => bool)) private _isInCollection;
    mapping(address => mapping(uint256 => uint256)) private collectionIndex; // for O(1) remove

    // ─────────────────────────────────────────────────────────
    // Storage: Watched
    // ─────────────────────────────────────────────────────────

    mapping(address => mapping(uint256 => bool)) private _isWatched;

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    event MovieRated(address indexed rater, uint256 indexed movieId, uint8 score, bool isUpdate);
    event AddedToCollection(address indexed user, uint256 indexed movieId);
    event RemovedFromCollection(address indexed user, uint256 indexed movieId);
    event WatchedStatusUpdated(address indexed user, uint256 indexed movieId, bool watched);

    // ─────────────────────────────────────────────────────────
    // Ratings
    // ─────────────────────────────────────────────────────────

    /// @notice Rate a title 1–5 stars. Calling again updates your existing rating;
    ///         the second call never inflates the count or the sum.
    function rateMovie(uint256 movieId, uint8 score) external {
        require(score >= 1 && score <= 5, "Score must be 1-5");

        uint8 previousScore = userScore[movieId][msg.sender];
        bool isUpdate = previousScore != 0;
        MovieStats storage m = stats[movieId];

        if (isUpdate) {
            // Replace old score in the running total
            m.totalScore = m.totalScore - previousScore + score;
        } else {
            m.totalScore += score;
            m.ratingCount += 1;
            if (!isTracked[movieId]) {
                isTracked[movieId] = true;
                ratedMovieIds.push(movieId);
            }
        }

        userScore[movieId][msg.sender] = score;
        emit MovieRated(msg.sender, movieId, score, isUpdate);
    }

    /// @notice Average scaled by 100 (e.g. 425 = 4.25 stars). Returns 0 if unrated.
    function getAverageRating(uint256 movieId) public view returns (uint256) {
        MovieStats memory m = stats[movieId];
        if (m.ratingCount == 0) return 0;
        return (m.totalScore * 100) / m.ratingCount;
    }

    /// @notice Bundles totalScore, ratingCount, and averageScaled into one call.
    function getMovieStats(uint256 movieId)
        external
        view
        returns (uint256 totalScore, uint256 ratingCount, uint256 averageScaled)
    {
        MovieStats memory m = stats[movieId];
        return (m.totalScore, m.ratingCount, getAverageRating(movieId));
    }

    function hasUserRated(uint256 movieId, address user) external view returns (bool) {
        return userScore[movieId][user] != 0;
    }

    function getUserRating(uint256 movieId, address user) external view returns (uint8) {
        return userScore[movieId][user];
    }

    function getRatedMovieIds() external view returns (uint256[] memory) {
        return ratedMovieIds;
    }

    function getRatedMovieCount() external view returns (uint256) {
        return ratedMovieIds.length;
    }

    // ─────────────────────────────────────────────────────────
    // Collection
    // ─────────────────────────────────────────────────────────

    /// @notice Add a title to your personal on-chain collection. Reverts on duplicate.
    function addToCollection(uint256 movieId) external {
        require(!_isInCollection[msg.sender][movieId], "Already in collection");
        collectionIndex[msg.sender][movieId] = userCollectionIds[msg.sender].length;
        userCollectionIds[msg.sender].push(movieId);
        _isInCollection[msg.sender][movieId] = true;
        emit AddedToCollection(msg.sender, movieId);
    }

    /// @notice Remove a title from your collection. Reverts if not present.
    function removeFromCollection(uint256 movieId) external {
        require(_isInCollection[msg.sender][movieId], "Not in collection");

        uint256[] storage ids = userCollectionIds[msg.sender];
        uint256 idx = collectionIndex[msg.sender][movieId];
        uint256 last = ids[ids.length - 1];

        ids[idx] = last;
        collectionIndex[msg.sender][last] = idx;
        ids.pop();

        delete _isInCollection[msg.sender][movieId];
        delete collectionIndex[msg.sender][movieId];

        emit RemovedFromCollection(msg.sender, movieId);
    }

    function isInCollection(address user, uint256 movieId) external view returns (bool) {
        return _isInCollection[user][movieId];
    }

    /// @notice Returns all TMDB/offset ids currently in a user's collection.
    function getUserCollection(address user) external view returns (uint256[] memory) {
        return userCollectionIds[user];
    }

    // ─────────────────────────────────────────────────────────
    // Watched
    // ─────────────────────────────────────────────────────────

    /// @notice Toggle watched status. Pass `watched = true` to mark watched, false to unmark.
    function markAsWatched(uint256 movieId, bool watched) external {
        _isWatched[msg.sender][movieId] = watched;
        emit WatchedStatusUpdated(msg.sender, movieId, watched);
    }

    function isWatched(address user, uint256 movieId) external view returns (bool) {
        return _isWatched[user][movieId];
    }
}