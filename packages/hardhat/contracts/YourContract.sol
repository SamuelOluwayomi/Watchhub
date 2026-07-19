// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title WatchHubRating
/// @notice Lets any wallet cast one rating (1-5) per movie, identified by its TMDB movie id.
///         A wallet can update its own rating, but it can never count twice toward the
///         average — this is what makes the score resistant to bot-farming or review
///         manipulation from a single address.
contract WatchHubRating {
    struct MovieStats {
        uint256 totalScore;   // sum of all current ratings for this movie
        uint256 ratingCount;  // number of distinct wallets that have rated this movie
    }

    // movieId => aggregate stats
    mapping(uint256 => MovieStats) private stats;

    // movieId => rater => their current score (0 means "hasn't rated")
    mapping(uint256 => mapping(address => uint8)) private userScore;

    // list of movie ids that have at least one rating, so the frontend can discover them
    uint256[] private ratedMovieIds;
    mapping(uint256 => bool) private isTracked;

    event MovieRated(address indexed rater, uint256 indexed movieId, uint8 score, bool isUpdate);

    /// @notice Rate a movie from 1 to 5 stars. Calling this again for the same movie
    ///         updates your existing rating instead of adding a second vote.
    function rateMovie(uint256 movieId, uint8 score) external {
        require(score >= 1 && score <= 5, "Score must be 1-5");

        uint8 previousScore = userScore[movieId][msg.sender];
        bool isUpdate = previousScore != 0;

        MovieStats storage m = stats[movieId];

        if (isUpdate) {
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

    /// @notice Average rating scaled by 100 (e.g. 425 means 4.25 stars). Returns 0 if unrated.
    function getAverageRating(uint256 movieId) public view returns (uint256 averageScaled) {
        MovieStats memory m = stats[movieId];
        if (m.ratingCount == 0) return 0;
        return (m.totalScore * 100) / m.ratingCount;
    }

    /// @notice Convenience getter bundling raw totals and the computed average.
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

    /// @notice All movie ids that have at least one onchain rating so far.
    ///         Useful for the frontend to build the "top rated" / "hit movies" list.
    function getRatedMovieIds() external view returns (uint256[] memory) {
        return ratedMovieIds;
    }

    function getRatedMovieCount() external view returns (uint256) {
        return ratedMovieIds.length;
    }
}