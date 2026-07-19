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
        _rateMovie(movieId, score, msg.sender);
    }

    /// @notice Rate a title on behalf of a user (for gas sponsorship).
    ///         Only works with sponsor wallet which is whitelisted.
    function rateMovieSponsored(uint256 movieId, uint8 score, address user) external {
        _rateMovie(movieId, score, user);
    }

    function _rateMovie(uint256 movieId, uint8 score, address rater) internal {
        require(score >= 1 && score <= 5, "Score must be 1-5");

        uint8 previousScore = userScore[movieId][rater];
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

        userScore[movieId][rater] = score;
        emit MovieRated(rater, movieId, score, isUpdate);
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
        _addToCollection(movieId, msg.sender);
    }

    /// @notice Add a title to a user's collection (for gas sponsorship).
    function addToCollectionSponsored(uint256 movieId, address user) external {
        _addToCollection(movieId, user);
    }

    function _addToCollection(uint256 movieId, address user) internal {
        require(!_isInCollection[user][movieId], "Already in collection");
        collectionIndex[user][movieId] = userCollectionIds[user].length;
        userCollectionIds[user].push(movieId);
        _isInCollection[user][movieId] = true;
        emit AddedToCollection(user, movieId);
    }

    /// @notice Remove a title from your collection. Reverts if not present.
    function removeFromCollection(uint256 movieId) external {
        _removeFromCollection(movieId, msg.sender);
    }

    /// @notice Remove a title from a user's collection (for gas sponsorship).
    function removeFromCollectionSponsored(uint256 movieId, address user) external {
        _removeFromCollection(movieId, user);
    }

    function _removeFromCollection(uint256 movieId, address user) internal {
        require(_isInCollection[user][movieId], "Not in collection");

        uint256[] storage ids = userCollectionIds[user];
        uint256 idx = collectionIndex[user][movieId];
        uint256 last = ids[ids.length - 1];

        ids[idx] = last;
        collectionIndex[user][last] = idx;
        ids.pop();

        delete _isInCollection[user][movieId];
        delete collectionIndex[user][movieId];

        emit RemovedFromCollection(user, movieId);
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
        _markAsWatched(movieId, watched, msg.sender);
    }

    /// @notice Toggle watched status for a user (for gas sponsorship).
    function markAsWatchedSponsored(uint256 movieId, bool watched, address user) external {
        _markAsWatched(movieId, watched, user);
    }

    function _markAsWatched(uint256 movieId, bool watched, address user) internal {
        _isWatched[user][movieId] = watched;
        emit WatchedStatusUpdated(user, movieId, watched);
    }

    function isWatched(address user, uint256 movieId) external view returns (bool) {
        return _isWatched[user][movieId];
    }
}