"""002_social_community_posts_likes_comments

Revision ID: 002_social
Revises: 001_initial
Create Date: 2026-10-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_social'
down_revision: Union[str, Sequence[str], None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. travel_posts
    op.create_table(
        'travel_posts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('destination_id', sa.String(length=50), sa.ForeignKey('destinations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('title', sa.String(length=150), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('moderation_status', sa.String(length=20), nullable=False, server_default='approved'),
    )
    op.create_index('ix_travel_posts_id', 'travel_posts', ['id'])
    op.create_index('ix_travel_posts_user_id', 'travel_posts', ['user_id'])
    op.create_index('ix_travel_posts_destination_id', 'travel_posts', ['destination_id'])
    op.create_index('ix_travel_posts_created_at', 'travel_posts', ['created_at'])
    op.create_index('ix_travel_posts_moderation_status', 'travel_posts', ['moderation_status'])

    # 2. post_likes
    op.create_table(
        'post_likes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('travel_posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post_like')
    )
    op.create_index('ix_post_likes_id', 'post_likes', ['id'])
    op.create_index('ix_post_likes_user_id', 'post_likes', ['user_id'])
    op.create_index('ix_post_likes_post_id', 'post_likes', ['post_id'])

    # 3. post_comments
    op.create_table(
        'post_comments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('travel_posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('moderation_status', sa.String(length=20), nullable=False, server_default='approved'),
    )
    op.create_index('ix_post_comments_id', 'post_comments', ['id'])
    op.create_index('ix_post_comments_user_id', 'post_comments', ['user_id'])
    op.create_index('ix_post_comments_post_id', 'post_comments', ['post_id'])
    op.create_index('ix_post_comments_created_at', 'post_comments', ['created_at'])
    op.create_index('ix_post_comments_moderation_status', 'post_comments', ['moderation_status'])


def downgrade() -> None:
    op.drop_table('post_comments')
    op.drop_table('post_likes')
    op.drop_table('travel_posts')
